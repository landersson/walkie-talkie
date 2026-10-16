/**
 * Renders the Markdown subset agents write (lists, bold, inline code, code
 * blocks, tables, headings, quotes, links) as HTML for the dashboard.
 *
 * Everything is HTML-escaped; only http(s) URLs become links. Single newlines
 * are kept as line breaks, as agents use them. Italics need *word-bounded
 * asterisks*; `_` is left alone, as it shows up far more in snake_case.
 *
 * The function must stay self-contained: the dashboard embeds it with toString().
 */
export function renderMarkdown(src: string): string {
  const esc = (t: string): string =>
    t.replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );

  const link = (url: string, text: string): string =>
    `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;

  // Inline formatting. Code spans and links become placeholders first so
  // nothing inside them is formatted, then the rest is escaped.
  const inline = (text: string): string => {
    const tokens: string[] = [];
    const hold = (html: string): string => {
      tokens.push(html);
      return `\uE000${tokens.length - 1}\uE000`;
    };
    // (\uE000, a private-use character, marks placeholders, so drop any already there)
    let s = text.replace(/\uE000/g, "").replace(/`([^`]+)`/g, (_m, code: string) => hold(`<code>${esc(code)}</code>`));
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, url: string) =>
      hold(link(url, label)),
    );
    s = s.replace(/https?:\/\/[^\s<>"'`*]+/g, (url: string) => {
      // Leave trailing punctuation outside the link, and a ")" unless the URL opened one
      let u = url;
      while (/[.,;:!?'")\]]$/.test(u)) {
        if (u.endsWith(")") && u.split("(").length >= u.split(")").length) break;
        u = u.slice(0, -1);
      }
      return hold(link(u, u)) + url.slice(u.length);
    });
    s = esc(s);
    s = s.replace(/\*\*(\S(?:(?:[^*\n]|\*(?!\*))*?\S)?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s([>])\*(\S|\S[^*\n]*?[^\s*])\*(?=[\s.,;:!?)\]<&]|$)/g, "$1<em>$2</em>");
    return s.replace(/\uE000(\d+)\uE000/g, (_m, i: string) => tokens[Number(i)]);
  };

  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  const lists: { tag: string; indent: number }[] = [];

  const flushPara = (): void => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`);
    para = [];
  };
  const closeLists = (above = -1): void => {
    while (lists.length && lists[lists.length - 1].indent > above) {
      out.push(`</li></${lists.pop()?.tag}>`);
    }
  };
  const indentOf = (line: string): number => {
    const lead = /^[ \t]*/.exec(line)?.[0] ?? "";
    return lead.replace(/\t/g, "    ").length;
  };
  const cells = (row: string): string[] => {
    let r = row.trim();
    if (r.startsWith("|")) r = r.slice(1);
    if (r.endsWith("|")) r = r.slice(0, -1);
    return r.split("|").map((c) => c.trim());
  };
  const isTableSep = (line: string): boolean =>
    line.includes("-") && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code block (kept verbatim)
    const fence = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      flushPara();
      if (!indentOf(line)) closeLists();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      out.push(`<pre><code>${esc(body.join("\n"))}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      // A blank line ends a paragraph; a list carries on if the next line belongs to it
      flushPara();
      continue;
    }

    // Table: a header row, then a separator row
    if (line.trim().startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushPara();
      closeLists();
      const align = cells(lines[i + 1]).map((c) =>
        c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "",
      );
      const cell = (tag: string, text: string, k: number): string =>
        `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ""}>${inline(text)}</${tag}>`;
      let html = `<div class="md-table"><table><thead><tr>${cells(line)
        .map((c, k) => cell("th", c, k))
        .join("")}</tr></thead><tbody>`;
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        html += `<tr>${cells(lines[i])
          .map((c, k) => cell("td", c, k))
          .join("")}</tr>`;
        i++;
      }
      i--;
      out.push(`${html}</tbody></table></div>`);
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushPara();
      closeLists();
      out.push(`<div class="md-h md-h${heading[1].length}">${inline(heading[2])}</div>`);
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara();
      closeLists();
      out.push("<hr>");
      continue;
    }

    if (/^\s*>/.test(line)) {
      flushPara();
      closeLists();
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      i--;
      out.push(`<blockquote>${quote.map(inline).join("<br>")}</blockquote>`);
      continue;
    }

    const item = /^(\s*)([-*+•]|(\d{1,4})[.)])\s+(.*)$/.exec(line);
    if (item) {
      flushPara();
      const indent = indentOf(line);
      const tag = item[3] ? "ol" : "ul";
      closeLists(indent);
      const top = lists[lists.length - 1];
      if (top && top.indent === indent && top.tag !== tag) closeLists(indent - 1);
      const current = lists[lists.length - 1];
      if (current && current.indent >= indent) {
        out.push(`</li><li>${inline(item[4])}`);
      } else {
        const start = item[3] && item[3] !== "1" ? ` start="${Number(item[3])}"` : "";
        out.push(`<${tag}${start}><li>${inline(item[4])}`);
        lists.push({ tag, indent });
      }
      continue;
    }

    // An indented line inside a list continues the current item
    if (lists.length && indentOf(line) > 0) {
      out.push(`<br>${inline(line.trim())}`);
      continue;
    }

    closeLists();
    para.push(line);
  }
  flushPara();
  closeLists();
  return out.join("");
}
