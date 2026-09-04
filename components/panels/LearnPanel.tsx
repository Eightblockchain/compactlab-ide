"use client";

import { useState } from "react";
import { Button, Badge } from "@/components/ui";
import { useIDEStore } from "@/store/ide";
import { cn } from "@/lib/utils";
import {
  LEARN_DOCS_HOME,
  LEARN_FAUCET_URL,
  LEARN_TOPICS,
  type LearnCodeBlock,
  type LearnTopic,
} from "@/lib/learn-content";
import {
  COMPACT_COMPILER_PACKAGE,
  COMPACT_LANGUAGE_VERSION,
} from "@/lib/version";

export function LearnPanel() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const setNewProjectModalOpen = useIDEStore((s) => s.setNewProjectModalOpen);

  const topic = activeId ? LEARN_TOPICS.find((t) => t.id === activeId) : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 px-3 pt-1 pb-3 border-b border-border space-y-2">
        <p className="text-xs text-text-secondary leading-relaxed">
          Concepts and examples from Midnight Compact docs. Language{" "}
          <span className="font-mono text-text-primary">{COMPACT_LANGUAGE_VERSION}</span>, compiler{" "}
          <span className="font-mono text-text-primary">+{COMPACT_COMPILER_PACKAGE}</span>.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <a
            href={LEARN_DOCS_HOME}
            target="_blank"
            rel="noopener noreferrer"
            className="text-2xs text-accent hover:underline"
          >
            Official docs ↗
          </a>
          <span className="text-2xs text-text-muted">·</span>
          <a
            href={LEARN_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-2xs text-accent hover:underline"
          >
            Preprod faucet ↗
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {topic ? (
          <TopicDetail
            topic={topic}
            onBack={() => setActiveId(null)}
            onCreate={(template) => setNewProjectModalOpen(true, template)}
          />
        ) : (
          <TopicIndex onSelect={setActiveId} onCreate={(t) => setNewProjectModalOpen(true, t)} />
        )}
      </div>
    </div>
  );
}

function TopicIndex({
  onSelect,
  onCreate,
}: {
  onSelect: (id: string) => void;
  onCreate: (template: string) => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="p-3 bg-info/6 border border-info/15 rounded-md">
        <p className="text-xs text-text-secondary leading-relaxed">
          Start with Midnight / Compact / ZK, then pragma vs compiler, ledger, circuits vs witnesses,
          and disclose(). Each topic has a Create action that opens a matching CompactLab template.
        </p>
      </div>

      <div className="space-y-1.5">
        {LEARN_TOPICS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={cn(
              "w-full text-left p-3 rounded-md border border-border bg-surface-2",
              "hover:border-border-strong hover:bg-white/[0.03] transition-colors",
            )}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-2xs font-mono text-text-muted mt-0.5 w-4 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-text-primary">{t.title}</div>
                <div className="mt-0.5 text-2xs text-text-muted">{t.whenStuck}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="pt-2 border-t border-border space-y-2">
        <p className="text-2xs font-medium text-text-muted uppercase tracking-wide">
          Build from a template
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["hello-world", "Hello World"],
              ["counter", "Counter"],
              ["bulletin-board", "Bulletin Board"],
              ["voting", "Voting"],
            ] as const
          ).map(([key, label]) => (
            <Button key={key} size="xs" variant="default" onClick={() => onCreate(key)}>
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TopicDetail({
  topic,
  onBack,
  onCreate,
}: {
  topic: LearnTopic;
  onBack: () => void;
  onCreate: (template: string) => void;
}) {
  return (
    <div className="p-4 space-y-5">
      <div className="flex items-start gap-2">
        <Button size="xs" variant="ghost" onClick={onBack} className="-ml-1.5">
          ← All topics
        </Button>
      </div>

      <div>
        <h3 className="text-base font-semibold text-text-primary">{topic.title}</h3>
        <Badge variant="info" className="mt-2">
          {topic.whenStuck}
        </Badge>
      </div>

      <section className="space-y-1.5">
        <SectionLabel>Concept</SectionLabel>
        <p className="text-xs text-text-secondary leading-relaxed">{topic.concept}</p>
      </section>

      <section className="space-y-2">
        <SectionLabel>Deep dive</SectionLabel>
        <ul className="space-y-2">
          {topic.points.map((point, i) => (
            <li
              key={i}
              className="text-xs text-text-secondary leading-relaxed pl-3 border-l-2 border-border"
            >
              {point}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <SectionLabel>Examples</SectionLabel>
        {topic.examples.map((ex) => (
          <CodeExample key={ex.title} block={ex} />
        ))}
      </section>

      <section className="space-y-2 pt-1 border-t border-border">
        <SectionLabel>Try it in CompactLab</SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          {topic.tryTemplate && (
            <Button size="sm" variant="accent" onClick={() => onCreate(topic.tryTemplate!)}>
              {topic.tryLabel ?? "Create project"}
            </Button>
          )}
          {topic.docsUrl && (
            <a
              href={topic.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline"
            >
              {topic.docsLabel ?? "Read docs"} ↗
            </a>
          )}
        </div>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-2xs font-medium text-text-muted uppercase tracking-wide">{children}</h4>
  );
}

function CodeExample({ block }: { block: LearnCodeBlock }) {
  return (
    <div className="rounded-md border border-border overflow-hidden bg-surface-2">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border bg-white/[0.02]">
        <span className="text-2xs font-medium text-text-secondary truncate">{block.title}</span>
        <Badge variant="muted">{block.language}</Badge>
      </div>
      <pre className="p-3 overflow-x-auto text-2xs font-mono text-text-primary leading-relaxed">
        <code>{block.code}</code>
      </pre>
      {block.sourceNote && (
        <p className="px-3 py-2 text-2xs text-text-muted border-t border-border leading-relaxed">
          Source: {block.sourceNote}
        </p>
      )}
    </div>
  );
}
