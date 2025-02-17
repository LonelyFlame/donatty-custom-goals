class DataController {
  /**
   * @type {DataService}
   */
  _dataService;
  /**
   * @type {DataService}
   */
  _dataServiceOpposite;

  get percent() {
    let percent = this._dataService.percent;

    if(this._dataServiceOpposite) {
      const percentOpposite = this._dataServiceOpposite.percent;
      percent = percent - percentOpposite;
    }

    return percent;
  }

  get diff() {
    let diff = this._dataService.raised;

    if(this._dataServiceOpposite) {
      const raisedOpposite = this._dataServiceOpposite.raised;
      diff = diff - raisedOpposite;
    }

    return diff;
  }

  /**
   * @param {{ref: string, token: string}} goal
   * @param {{ref: string, token: string}?} goalOpposite
   */
  constructor(goal, goalOpposite) {
    document.addEventListener(`${goal.ref}_data`, () => this._update(goal.ref));
    this._dataService = new DataService(goal);

    if (goalOpposite) {
      document.addEventListener(`${goalOpposite.ref}_data`, () => this._update(goalOpposite.ref));
      this._dataServiceOpposite = new DataService(goalOpposite);
    }
  }

  _update() {
    const detail = {
      percent: this.percent,
      diff: this.diff,
      goal: {
        goal: this._dataService.goal,
        raised: this._dataService.raised,
        percent: this._dataService.percent,
      },
    };

    if (this._dataServiceOpposite) {
      detail.goalOpposite = {
        goal: this._dataServiceOpposite.goal,
        raised: this._dataServiceOpposite.raised,
        percent: this._dataServiceOpposite.percent,
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
