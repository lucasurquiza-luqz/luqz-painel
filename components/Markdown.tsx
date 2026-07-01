import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Renderiza markdown (com tabelas GFM) no visual dark do painel. Usado pra
// narrativa do plano de mídia: diagnóstico, cenários, controle semanal, etc.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-zinc-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h2 className="mt-5 border-b border-white/10 pb-1.5 text-base font-semibold text-white first:mt-0" {...p} />,
          h2: (p) => <h3 className="mt-5 text-sm font-semibold text-white first:mt-0" {...p} />,
          h3: (p) => <h4 className="mt-4 text-[13px] font-semibold text-zinc-100 first:mt-0" {...p} />,
          p: (p) => <p className="text-[13px] leading-relaxed text-zinc-300" {...p} />,
          ul: (p) => <ul className="ml-4 list-disc space-y-1 marker:text-zinc-600" {...p} />,
          ol: (p) => <ol className="ml-4 list-decimal space-y-1 marker:text-zinc-600" {...p} />,
          li: (p) => <li className="text-[13px] text-zinc-300" {...p} />,
          strong: (p) => <strong className="font-semibold text-zinc-100" {...p} />,
          a: (p) => <a className="text-[#FFB185] underline decoration-white/20 underline-offset-2 hover:text-[#FF8F50]" target="_blank" rel="noreferrer" {...p} />,
          blockquote: (p) => <blockquote className="border-l-2 border-[#FF8F50]/40 pl-3 text-zinc-400" {...p} />,
          code: (p) => <code className="rounded bg-white/10 px-1 py-0.5 text-[12px] text-zinc-200" {...p} />,
          hr: () => <hr className="border-white/10" />,
          table: (p) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]" {...p} />
            </div>
          ),
          thead: (p) => <thead className="text-left text-zinc-400" {...p} />,
          th: (p) => <th className="border border-white/10 bg-white/5 px-2.5 py-1.5 font-semibold" {...p} />,
          td: (p) => <td className="border border-white/10 px-2.5 py-1.5 text-zinc-300" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
