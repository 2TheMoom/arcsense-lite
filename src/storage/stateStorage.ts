import fs from "fs";
import path from "path";

const STATE_FILE = path.join(__dirname, "../../data/state.json");

type State = {
  contractHistory: Record<string, number>;
  lastFailureRate: number;
};

const defaultState: State = {
  contractHistory: {},
  lastFailureRate: 0,
};

export function loadState(): State {
  try {
    if (!fs.existsSync(STATE_FILE)) return defaultState;
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return defaultState;
  }
}

export function saveState(state: State) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}