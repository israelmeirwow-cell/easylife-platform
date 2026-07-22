import { PageHeader } from '../components/PageHeader';
import CashflowShowcase from '../components/CashflowShowcase';

export default function Cashflow() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="תזרים"
        subtitle="תמונת מזומנים חיה מחשבוניות, סליקה והזמנות מהחנות — בלי חיבור לבנק ובלי אקסל."
        badge="בקרוב"
      />
      <CashflowShowcase />
    </div>
  );
}
