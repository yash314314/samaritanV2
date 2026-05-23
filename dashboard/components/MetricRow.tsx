export default function MetricRow({
    label,
    value
  }: {
    label: string;
    value: any;
  }) {
    return (
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
    );
  }