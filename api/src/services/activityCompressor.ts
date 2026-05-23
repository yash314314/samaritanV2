export function compressActivities(activities:any[]) {

    if (!activities.length) return [];
  
    const threshold = 60000; // 60s gap allowed
  
    const compressed:any[] = [];
  
    let current = { ...activities[0] };
  
    for (let i = 1; i < activities.length; i++) {
  
      const next = activities[i];
  
      const gap =
        new Date(next.startTime).getTime() -
        new Date(current.endTime).getTime();
  
      const sameApp =
        current.appName === next.appName;
  
      if (sameApp && gap < threshold) {
  
        // extend block
        current.endTime = next.endTime;
        current.duration += next.duration;
  
      } else {
  
        compressed.push(current);
        current = { ...next };
  
      }
  
    }
  
    compressed.push(current);
  
    return compressed;
  
  }