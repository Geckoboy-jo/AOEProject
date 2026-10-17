class Wrapper
{
    constructor()
    {
        this.actionStack = new Stack();
        
    }

    addAction(action)
    {
        if (!action || (action.type !== "fill" && !Array.isArray(action.points))) {
            throw new TypeError("action must contain a points array");
        }

        this.actionStack.push(action);
        return action;
    }

    back()
    {
        return this.actionStack.pop();
    }

    clear()
    {
        this.actionStack.clear();
    }

    get actions()
    {
        return this.actionStack.actions;
    }
}