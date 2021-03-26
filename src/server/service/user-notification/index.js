const toArrayFromCsv = require('@commons/util/to-array-from-csv');

/**
 * service class of UserNotification
 */
class UserNotificationService {

  constructor(crowi) {
    this.crowi = crowi;

    this.Page = this.crowi.model('Page');
  }

  /**
   * fire user notification
   *
   * @memberof UserNotificationService
   *
   * @param {Page} page
   * @param {User} user
   * @param {string} slackChannelsStr comma separated string. e.g. 'general,channel1,channel2'
   * @param {string} mode 'create' or 'update' or 'comment'
   * @param {string} previousRevision
   * @param {Comment} comment
   */
  async fire(page, user, slackChannelsStr, mode, option, comment = {}) {
    const {
      slackNotificationService, configManager, slackLegacy, slack,
    } = this.crowi;

    const opt = option || {};
    const previousRevision = opt.previousRevision || '';

    await page.updateSlackChannels(slackChannelsStr);

    if (!slackNotificationService.hasSlackConfig()) {
      throw new Error('slackNotificationService has not been set up');
    }

    // "dev,slacktest" => [dev,slacktest]
    const slackChannels = toArrayFromCsv(slackChannelsStr);

    const promises = slackChannels.map(async(chan) => {
      let res;
      if (mode === 'comment') {
        if (configManager.getConfig('crowi', 'slackbot:token')) {
          res = await slack.postComment(comment, user, chan, page.path);
        }
        else {
          res = await slackLegacy.postComment(comment, user, chan, page.path);
        }
      }
      else if (configManager.getConfig('crowi', 'slackbot:token')) {
        res = await slack.postPage(page, user, chan, mode, previousRevision);
      }
      else {
        res = await slackLegacy.postPage(page, user, chan, mode, previousRevision);
      }
      if (res.status !== 'ok') {
        throw new Error(`fail to send slack notification to #${chan} channel`);
      }
      return res;
    });

    return Promise.allSettled(promises);
  }

}

module.exports = UserNotificationService;
