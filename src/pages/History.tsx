import type { HistoryItem } from "../lib/types";

interface HistoryProps {
  items: HistoryItem[];
}

export default function History({ items }: HistoryProps) {
  return (
    <section aria-label="历史记录">
      <h2>历史记录</h2>
      {items.length === 0 ? (
        <p>暂无历史记录。</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.createdAt}</strong>
              <p>{item.finalText}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
