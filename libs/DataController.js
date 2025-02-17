class DataController {
  /**
   * @type {DataService}
   */
  #dataService;
  /**
   * @type {DataService}
   */
  #dataServiceReverse;

  get percent() {
    let percent = this.#dataService.percent;

    if(this.#dataServiceReverse) {
      const percentReverse = this.#dataServiceReverse.percent;
      percent = percent - percentReverse;
    }

    return percent;
  }

  /**
   *
   * @param {{ref: string, token: string}} goal
   * @param {{ref: string, token: string}?} goalReverse
   */
  constructor(goal, goalReverse) {
    document.addEventListener(`${goal.ref}_data`, () => this.#update(goal.ref));
    this.#dataService = new DataService(goal);

    if (goalReverse) {
      document.addEventListener(`${goalReverse.ref}_data`, () => this.#update(goalReverse.ref));
      this.#dataServiceReverse = new DataService(goalReverse);
    }
  }

  #update() {
    const detail = {
      percent: this.percent,
      goal: {
        goal: this.#dataService.goal,
        raised: this.#dataService.raised,
        percent: this.#dataService.percent,
      },
    };

    if (this.#dataServiceReverse) {
      detail.goalReverse = {
        goal: this.#dataServiceReverse.goal,
        raised: this.#dataServiceReverse.raised,
        percent: this.#dataServiceReverse.percent,
      };
    }

    document.dispatchEvent(new CustomEvent('goal_updated', { detail }));
  }
}

export default DataController;
