export default function IntelligencePanel({ intel }: any) {

    return (
      <div className="grid grid-cols-3 gap-6">
  
        <Metric
          title="Intra-day Drift"
          value={intel.driftScore}
        />
  
        <Metric
          title="Entropy Trend"
          value={intel.entropyTrend}
        />
  
        <Metric
          title="Performance Probability"
          value={intel.highPerformanceProbability}
        />
  
      </div>
    )
  }
  
  function Metric({ title, value }: any) {
  
    return (
      <div className="bg-white p-6 shadow rounded">
  
        <p className="text-gray-500">
          {title}
        </p>
  
        <p className="text-2xl font-bold">
          {value}
        </p>
  
      </div>
    )
  }