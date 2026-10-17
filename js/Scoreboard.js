class Scoreboard {
    constructor() {
        this.scores = [];
    }

    addScore(score) {
        this.scores.push(score);
    }

    getHighScore() {
        return Math.max(...this.scores);
    }
}