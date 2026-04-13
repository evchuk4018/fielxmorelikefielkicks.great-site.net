export type PrescoutingTeamRanking = {
  rank: number;
  teamNumber: number;
  event1Points: number;
  event2Points: number;
  districtChampPoints: number | null;
  rookieBonusPoints: number | null;
  totalPoints: number;
  qualifiedForDcmp: boolean;
  qualifiedForCmp: boolean;
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
