import React, { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: 'What is Samaritan and how does it differ from Rize or RescueTime?',
    answer:
      'Samaritan is a local-first desktop activity tracker and focus engineering platform inspired by Rize. Unlike cloud-based trackers that charge monthly subscriptions and upload window titles to external servers, Samaritan runs entirely on your local machine using an Electron observer, Node Express API, PostgreSQL 15, and Next.js 14.'
  },
  {
    question: 'Does Samaritan send my desktop activity or window titles to the cloud?',
    answer:
      'No. 100% of desktop observation data, window titles, process paths, and metric logs remain in your local PostgreSQL database (localhost:5432). Samaritan contains zero telemetry or external analytics services.'
  },
  {
    question: 'How does Samaritan measure focus, entropy, and burnout risk?',
    answer:
      'Focus scores use duration-weighted window observations mapped against classified category/intent focus impacts. Entropy measures attentional fragmentation and context switching frequency. Burnout risk evaluates sustained load without adequate recovery breaks over daily baselines.'
  },
  {
    question: 'How do the 4 Deep Work enforcement levels work?',
    answer:
      'Deep work sessions support four enforcement levels: Observe (records distractions quietly), Warn (shows warning alerts), Require Reason (demands an override justification), and Block (preemptively terminates disallowed Windows process executables like taskkill /F).'
  },
  {
    question: 'Can I create custom classification rules for proprietary tools?',
    answer:
      'Yes. Samaritan includes an AppPattern engine that matches app names and window title regular expressions. When reviewing low-confidence entries in the Pending Time Entries inbox, enabling "Remember Context" automatically saves exact regex patterns for future observations.'
  },
  {
    question: 'How do I run Samaritan locally and populate synthetic demonstration data?',
    answer:
      'First start PostgreSQL with `docker compose up -d postgres`, apply Prisma migrations with `npx prisma migrate deploy`, run `npm run seed:demo` in `api/` to generate rich synthetic data, and start the API (`npm run dev` in `api/`) and dashboard (`npm run dev` in `dashboard/`).'
  }
];

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 bg-[#050506] border-b border-white/5 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
            <HelpCircle className="w-3.5 h-3.5" />
            Frequently Asked Questions
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            Technical & Architecture FAQ
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg mt-4">
            Everything you need to know about Samaritan's local-first architecture and focus engine.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-[#0B0B0D] border border-white/10 overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-bold text-base sm:text-lg text-white hover:text-purple-300 transition-colors"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-purple-400 transition-transform duration-300 shrink-0 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-sm text-zinc-400 leading-relaxed border-t border-white/5 pt-4 animate-fadeIn">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
