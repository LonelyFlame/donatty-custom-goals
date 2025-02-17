class DataController {
  /**
   * @type {DataService}
   */
  #dataService;
  /**
   * @type {DataService}
   */
  #dataServiceOpposite;

  get percent() {
    let percent = this.#dataService.percent;

    if(this.#dataServiceOpposite) {
      const percentOpposite = this.#dataServiceOpposite.percent;
      percent = percent - percentOpposite;
    }

    return percent;
  }

  get diff() {
    let diff = this.#dataService.raised;

    if(this.#dataServiceOpposite) {
      const raisedOpposite = this.#dataServiceOpposite.raised;
      diff = diff - raisedOpposite;
    }

    return diff;
  }

  /**
   * @param {{ref: string, token: string}} goal
   * @param {{ref: string, token: string}?} goalOpposite
   */
  constructor(goal, goalOpposite) {
    document.addEventListener(`${goal.ref}_data`, () => this.#update(goal.ref));
    this.#dataService = new DataService(goal);

    if (goalOpposite) {
      document.addEventListener(`${goalOpposite.ref}_data`, () => this.#update(goalOpposite.ref));
      this.#dataServiceOpposite = new DataService(goalOpposite);
    }
  }

  #update() {
    const detail = {
      percent: this.percent,
      diff: this.diff,
      goal: {
        goal: this.#dataService.goal,
        raised: this.#dataService.raised,
        percent: this.#dataService.percent,
      },
    };

    if (this.#dataServiceOpposite) {
      detail.goalOpposite = {
        goal: this.#dataServiceOpposite.goal,
        raised: this.#dataServiceOpposite.raised,
        percent: this.#dataServiceOpposite.percent,
      };
    }

    document.dispatchEvent(new CustomEvent('goal_updated', { detail }));
  }

  /**
   * @param {number?} limit
   * @returns {number}
   */
  getPercents = (limit) => {
    let percent = this.percent;

    if (limit) {
      const diff = this.diff;
      percent = diff / limit;
    }

    return Math.max(Math.min(percent, 1), -1);
  }
}

export default DataController;
