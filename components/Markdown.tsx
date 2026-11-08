import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown as formatted text, with GitHub extras (tables, task lists, strikethrough, bare links).
 * Raw HTML in the text is shown as text, never run, so a note can't inject anything into the page.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ href, title, children }) => <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
