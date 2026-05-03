type Job = {
  blockNumber: number;
  txHashes: string[];
};

const queue: Job[] = [];

export function enqueue(job: Job) {
  queue.push(job);
}

export function dequeue(): Job | undefined {
  return queue.shift();
}