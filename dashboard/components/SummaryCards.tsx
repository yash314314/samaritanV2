export default function SummaryCards({ data }: any) {

    return (
      <div className="grid grid-cols-4 gap-6">
  
        <Card title="Focus Score" value={data.assistant.focusScore} />
  
        <Card title="Deep Work %" value={data.assistant.deepWorkRatio} />
  
        <Card title="Burnout Risk" value={data.burnout.burnoutRisk} />
  
        <Card title="Deep Work Streak" value={data.streak.days} />
  
      </div>
    )
  }
  
  function Card({ title, value }: any) {
  
    return (
      <div className="bg-white p-6 shadow rounded">
  
        <p className="text-sm text-gray-500">
          {title}
        </p>
  
        <p className="text-3xl font-bold">
          {value}
        </p>
  
      </div>
    )
  }