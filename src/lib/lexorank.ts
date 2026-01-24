import { LexoRank } from 'lexorank';

export const generateInitialRank = () => {
    return LexoRank.middle().toString();
};

export const generateRankBetween = (prevRank?: string, nextRank?: string) => {
    if (!prevRank && !nextRank) {
        return LexoRank.middle().toString();
    }
    if (!prevRank && nextRank) {
        return LexoRank.parse(nextRank).genPrev().toString();
    }
    if (prevRank && !nextRank) {
        return LexoRank.parse(prevRank).genNext().toString();
    }
    if (prevRank && nextRank) {
        return LexoRank.parse(prevRank).between(LexoRank.parse(nextRank)).toString();
    }
    return LexoRank.middle().toString();
};
