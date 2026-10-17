class Stack {
    constructor() {
        this.actions = [];
    }

    push(action) {
        this.actions.push(action);
    }

    pop() {
        return this.actions.pop();
    }

    clear() {
        this.actions.length = 0;
    }

    get top() {
        return this.actions[this.actions.length - 1];
    }
}
