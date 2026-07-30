export type PrescoutingTeamSettings = {
  seasonYear: number;
  teamNumbers: number[];
};

export type PrescoutingTeamMatchChoice = {
  teamNumber: number;
  teamName: string;
  matchKey: string;
  eventKey: string;
  eventName: string;
  matchNumber: number;
  setNumber: number;
  compLevel: string;
};

export type PrescoutingScoutedMatchKey = {
  teamNumber: number;
  matchKey: string;
};
