function FocusBar({ score }: { score: number }) {

    return (
      <div className="w-full bg-zinc-800 h-2 rounded">
        <div
          className="bg-red-500 h-2 rounded"
          style={{ width: `${score}%` }}
        />
      </div>
    )
  }