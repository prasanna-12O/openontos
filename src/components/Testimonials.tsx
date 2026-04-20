import { Quote, Star } from 'lucide-react';
import { motion } from 'framer-motion';

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  initials: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "OpenOntos turned a 3-week schema mapping project into an afternoon. The AI agent actually understands our retail domain.",
    author: 'Priya Raghavan',
    role: 'Lead Data Engineer',
    company: 'NorthBeam Retail',
    initials: 'PR',
  },
  {
    quote:
      "Going from CSV samples to deployed Snowflake bronze/silver/gold pipelines in one tool — exactly what our small team needed.",
    author: 'Marcus Chen',
    role: 'Analytics Architect',
    company: 'Helios Logistics',
    initials: 'MC',
  },
  {
    quote:
      "The ontology builder bridges the gap between our business glossary and physical schemas. Game changer for governance.",
    author: 'Elena Vásquez',
    role: 'Head of Data Platform',
    company: 'Aperture Health',
    initials: 'EV',
  },
];

export default function Testimonials() {
  return (
    <section className="mt-12 mb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">What practitioners are saying</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Early teams shipping data products with OpenOntos</p>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          <Star className="w-3 h-3 text-primary fill-primary" />
          <Star className="w-3 h-3 text-primary fill-primary" />
          <Star className="w-3 h-3 text-primary fill-primary" />
          <Star className="w-3 h-3 text-primary fill-primary" />
          <Star className="w-3 h-3 text-primary fill-primary" />
          <span className="ml-1.5">community-loved</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TESTIMONIALS.map((t, i) => (
          <motion.div
            key={t.author}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="bg-card border border-border rounded-xl p-5 flex flex-col hover:border-primary/40 transition-colors"
          >
            <Quote className="w-5 h-5 text-primary/60 mb-3 shrink-0" />
            <p className="text-sm leading-relaxed text-foreground/90 flex-1 mb-4">
              "{t.quote}"
            </p>
            <div className="flex items-center gap-3 pt-3 border-t border-border">
              <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground shrink-0">
                {t.initials}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{t.author}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {t.role} · {t.company}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
