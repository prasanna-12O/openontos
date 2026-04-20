import { useMemo, useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { Database, Search, ArrowLeft, BookOpen } from 'lucide-react';
import { DOCS, CATEGORIES, type DocPage } from '@/docs/content';
import { cn } from '@/lib/utils';

function renderBody(body: string) {
  // Lightweight markdown: ## headings, ``` code fences, blank-line paragraphs.
  const lines = body.split('\n');
  const blocks: JSX.Element[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={key++} className="text-xl font-semibold text-foreground mt-8 mb-3 scroll-mt-20">
          {line.slice(3)}
        </h2>
      );
      i++;
    } else if (line.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre
          key={key++}
          className="bg-muted/40 border border-border rounded-md p-3 text-xs font-mono overflow-x-auto my-3"
        >
          <code>{code.join('\n')}</code>
        </pre>
      );
    } else if (line.trim() === '') {
      i++;
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('## ') && !lines[i].startsWith('```')) {
        para.push(lines[i]);
        i++;
      }
      const text = para.join('\n');
      // bullet list detection
      if (para.every((l) => l.startsWith('- '))) {
        blocks.push(
          <ul key={key++} className="list-disc pl-5 space-y-1 my-3 text-sm text-foreground/90">
            {para.map((l, idx) => (
              <li key={idx}>{l.slice(2)}</li>
            ))}
          </ul>
        );
      } else if (/^\d+\.\s/.test(para[0])) {
        blocks.push(
          <ol key={key++} className="list-decimal pl-5 space-y-1 my-3 text-sm text-foreground/90">
            {para.map((l, idx) => (
              <li key={idx}>{l.replace(/^\d+\.\s/, '')}</li>
            ))}
          </ol>
        );
      } else {
        blocks.push(
          <p key={key++} className="text-sm text-foreground/90 leading-relaxed my-3">
            {text}
          </p>
        );
      }
    }
  }
  return blocks;
}

export default function Docs() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const fuse = useMemo(
    () =>
      new Fuse(DOCS, {
        keys: ['title', 'summary', 'body', 'category'],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    []
  );

  const results = query.trim() ? fuse.search(query).map((r) => r.item) : null;

  const current: DocPage = DOCS.find((d) => d.slug === slug) ?? DOCS[0];

  useEffect(() => {
    document.title = `${current.title} · OpenOntos Docs`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', current.summary);
  }, [current]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-sidebar/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 h-14">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center glow-primary">
              <Database className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold tracking-tight leading-tight">OpenOntos</h1>
              <p className="text-[9px] text-muted-foreground font-mono tracking-wider uppercase leading-tight">
                Documentation
              </p>
            </div>
          </Link>
          <div className="flex-1 max-w-md ml-4 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs…"
              className="w-full pl-8 pr-3 h-8 rounded-md bg-muted/40 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to app
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex gap-8 px-4 py-8">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 hidden md:block">
          <nav className="sticky top-20 space-y-6">
            {results ? (
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
                  {results.length} result{results.length === 1 ? '' : 's'}
                </div>
                <ul className="space-y-1">
                  {results.map((r) => (
                    <li key={r.slug}>
                      <Link
                        to={`/docs/${r.slug}`}
                        onClick={() => setQuery('')}
                        className="block text-sm py-1 text-foreground/80 hover:text-primary"
                      >
                        {r.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              CATEGORIES.map((cat) => (
                <div key={cat}>
                  <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
                    {cat}
                  </div>
                  <ul className="space-y-0.5">
                    {DOCS.filter((d) => d.category === cat).map((d) => (
                      <li key={d.slug}>
                        <Link
                          to={`/docs/${d.slug}`}
                          className={cn(
                            'block text-sm px-2 py-1 rounded transition-colors',
                            d.slug === current.slug
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-foreground/70 hover:text-foreground hover:bg-muted/40'
                          )}
                        >
                          {d.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 max-w-3xl">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
            <BookOpen className="w-3 h-3" />
            {current.category}
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">{current.title}</h1>
          <p className="text-base text-muted-foreground mb-6">{current.summary}</p>
          <article className="prose-invert">{renderBody(current.body)}</article>

          {/* Prev / Next */}
          <DocsNav currentSlug={current.slug} />
        </main>
      </div>
    </div>
  );
}

function DocsNav({ currentSlug }: { currentSlug: string }) {
  const idx = DOCS.findIndex((d) => d.slug === currentSlug);
  const prev = idx > 0 ? DOCS[idx - 1] : null;
  const next = idx < DOCS.length - 1 ? DOCS[idx + 1] : null;
  return (
    <div className="mt-12 pt-6 border-t border-border flex items-center justify-between gap-4">
      {prev ? (
        <Link
          to={`/docs/${prev.slug}`}
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          ← {prev.title}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          to={`/docs/${next.slug}`}
          className="text-sm text-muted-foreground hover:text-primary transition-colors text-right"
        >
          {next.title} →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
