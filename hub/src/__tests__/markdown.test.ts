import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../markdown.js";

describe("renderMarkdown", () => {
  it("escapes HTML everywhere", () => {
    expect(renderMarkdown('<img src=x onerror="alert(1)">')).toBe(
      "<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>",
    );
    expect(renderMarkdown("`<b>`")).toBe("<p><code>&lt;b&gt;</code></p>");
    expect(renderMarkdown("```\n<script>\n```")).toBe("<pre><code>&lt;script&gt;</code></pre>");
  });

  it("keeps single newlines as line breaks and blank lines as paragraphs", () => {
    expect(renderMarkdown("a\nb\n\nc")).toBe("<p>a<br>b</p><p>c</p>");
  });

  it("renders bold and inline code, but not code contents or stray asterisks", () => {
    expect(renderMarkdown("**Fix:** run `a **b** c` now")).toBe(
      "<p><strong>Fix:</strong> run <code>a **b** c</code> now</p>",
    );
    expect(renderMarkdown("{**os.environ} and snake_case_name, 2*3*4, a * b * c")).toBe(
      "<p>{**os.environ} and snake_case_name, 2*3*4, a * b * c</p>",
    );
  });

  it("renders word-bounded *italics*, also inside bold", () => {
    expect(renderMarkdown("it *does* work (*really*).")).toBe("<p>it <em>does</em> work (<em>really</em>).</p>");
    expect(renderMarkdown("**on zeus *and* beetle**")).toBe("<p><strong>on zeus <em>and</em> beetle</strong></p>");
  });

  it("keeps bold markers out of URLs", () => {
    expect(renderMarkdown("**https://a.b/x/**: ok")).toBe(
      '<p><strong><a href="https://a.b/x/" target="_blank" rel="noopener noreferrer">https://a.b/x/</a></strong>: ok</p>',
    );
  });

  it("renders nested and numbered lists", () => {
    expect(renderMarkdown("1. **one**\n2. two:\n   - a\n   - b\n3. three")).toBe(
      "<ol><li><strong>one</strong></li><li>two:<ul><li>a</li><li>b</li></ul></li><li>three</li></ol>",
    );
    expect(renderMarkdown("Intro:\n- a\n- b\nAfter")).toBe("<p>Intro:</p><ul><li>a</li><li>b</li></ul><p>After</p>");
    expect(renderMarkdown("3. c\n4. d")).toBe('<ol start="3"><li>c</li><li>d</li></ol>');
    expect(renderMarkdown("• a\n• b")).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("keeps a list going across blank lines and indented continuation lines", () => {
    expect(renderMarkdown("- a\n  more\n\n- b")).toBe("<ul><li>a<br>more</li><li>b</li></ul>");
  });

  it("switches list type at the same level", () => {
    expect(renderMarkdown("- a\n1. b")).toBe("<ul><li>a</li></ul><ol><li>b</li></ol>");
  });

  it("renders tables with alignment and inline formatting", () => {
    expect(renderMarkdown("| a | b |\n|---|--:|\n| **x** | 1 |")).toBe(
      '<div class="md-table"><table><thead><tr><th>a</th><th style="text-align:right">b</th></tr></thead>' +
        '<tbody><tr><td><strong>x</strong></td><td style="text-align:right">1</td></tr></tbody></table></div>',
    );
  });

  it("does not treat a lone | line as a table", () => {
    expect(renderMarkdown("| not a table")).toBe("<p>| not a table</p>");
  });

  it("renders headings, quotes and rules, but not #channel names", () => {
    expect(renderMarkdown("# Title\n> quoted\n---\n#all and #8 stay")).toBe(
      '<div class="md-h md-h1">Title</div><blockquote>quoted</blockquote><hr><p>#all and #8 stay</p>',
    );
  });

  it("links only http(s) URLs, leaving trailing punctuation outside", () => {
    expect(renderMarkdown("see https://a.b/c?x=1&y=2.")).toBe(
      '<p>see <a href="https://a.b/c?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">https://a.b/c?x=1&amp;y=2</a>.</p>',
    );
    expect(renderMarkdown("(https://a.b/x_(y))")).toBe(
      '<p>(<a href="https://a.b/x_(y)" target="_blank" rel="noopener noreferrer">https://a.b/x_(y)</a>)</p>',
    );
    expect(renderMarkdown("[docs](https://a.b) [bad](javascript:alert(1))")).toBe(
      '<p><a href="https://a.b" target="_blank" rel="noopener noreferrer">docs</a> [bad](javascript:alert(1))</p>',
    );
  });

  it("closes an unterminated code fence at the end", () => {
    expect(renderMarkdown("```\ncode")).toBe("<pre><code>code</code></pre>");
  });

  it("is self-contained, so the dashboard can embed it", () => {
    const fn = new Function(`${renderMarkdown.toString()}; return renderMarkdown;`)();
    expect(fn("**a**")).toBe("<p><strong>a</strong></p>");
  });
});
