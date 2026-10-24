import type { ReactNode } from "react";
import { DecodeText } from "./Decode";

// Page title in the readout voice shared by every page: uppercase display
// title, one line of plain description, actions on the right. The title
// resolves behind Samaritan's cursor when the page is entered.
export default function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="sam-ui mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="sam-title">
          <DecodeText text={title} />
        </h1>
        {description && <p className="mt-2 max-w-[72ch] text-[12px] text-key">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
