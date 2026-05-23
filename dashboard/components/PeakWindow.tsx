export default function PeakWindow({ data }: any) {
    if (!data) return null;
  
    return (
      <div className="bg-[#141414] p-4 rounded-xl border border-[#262626]">
        <h2 className="font-bold">Peak Focus Window</h2>
        <p>
          Best Hour: {data.peakHour}:00
        </p>
        <p>
          Average Focus: {data.peakFocusScore}
        </p>
      </div>
    );
  }
  