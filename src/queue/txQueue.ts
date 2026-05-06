import { Job } from "../types";

const queue: Job[] = [];

export function enqueueJob(job: Job) {
  queue.push(job);
}

export function dequeueJob(): Job | undefined {
  return queue.shift();
}