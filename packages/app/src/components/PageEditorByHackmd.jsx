import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';


import { appContainer } from '~/client/base';
import AppContainer from '~/client/services/AppContainer';
import EditorContainer from '~/client/services/EditorContainer';
import PageContainer from '~/client/services/PageContainer';
import { apiPost } from '~/client/util/apiv1-client';
import { getOptionsToSave } from '~/client/util/editor';
import { useCurrentPagePath, useCurrentPageId } from '~/stores/context';
import { useSWRxSlackChannels, useIsSlackEnabled, usePageTagsForEditors } from '~/stores/editor';
import {
  useEditorMode, useSelectedGrant, useSelectedGrantGroupId, useSelectedGrantGroupName,
} from '~/stores/ui';
import loggerFactory from '~/utils/logger';

import HackmdEditor from './PageEditorByHackmd/HackmdEditor';
import { withUnstatedContainers } from './UnstatedUtils';

const logger = loggerFactory('growi:PageEditorByHackmd');

const PageEditorByHackmd = (props) => {
  const { appContainer, pageContainer, editorContainer } = props; // wip

  const { t } = useTranslation();
  const { data: editorMode } = useEditorMode();
  const { data: currentPagePath } = useCurrentPagePath();
  const { data: slackChannelsData } = useSWRxSlackChannels(currentPagePath);
  const { data: isSlackEnabled } = useIsSlackEnabled();
  const { data: pageId } = useCurrentPageId();
  const { data: pageTags } = usePageTagsForEditors(pageId);
  const { data: grant } = useSelectedGrant();
  const { data: grantGroupId } = useSelectedGrantGroupId();
  const { data: grantGroupName } = useSelectedGrantGroupName();

  const slackChannels = slackChannelsData.toString();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  // for error
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorReason, setErrorReason] = useState('');

  // componentWillMount() {
  //   this.props.appContainer.registerComponentInstance('PageEditorByHackmd', this);
  // }

  // /**
  //  * return markdown document of HackMD
  //  * @return {Promise<string>}
  //  */
  // getMarkdown() {
  //   const { t } = this.props;
  //   if (!this.state.isInitialized) {
  //     return Promise.reject(new Error(t('hackmd.not_initialized')));
  //   }

  //   return this.hackmdEditor.getValue();
  // }

  // /**
  //  * reset initialized status
  //  */
  // reset() {
  //   this.setState({ isInitialized: false });
  // }

  const getHackmdUri = () => {
    const envVars = appContainer.getConfig().env;
    return envVars.HACKMD_URI;
  };

  // get isResume() {
  //   const { pageContainer } = this.props;
  //   const {
  //     pageIdOnHackmd, hasDraftOnHackmd, isHackmdDraftUpdatingInRealtime,
  //   } = pageContainer.state;

  //   const isPageExistsOnHackmd = (pageIdOnHackmd != null);
  //   return (isPageExistsOnHackmd && hasDraftOnHackmd) || isHackmdDraftUpdatingInRealtime;
  // }

  const startToEdit = useCallback(async() => {
    const hackmdUri = getHackmdUri();

    if (hackmdUri == null) {
      // do nothing
      return;
    }

    setIsInitialized(false);
    setIsInitializing(true);

    const params = {
      pageId,
    };

    try {
      const res = await apiPost('/hackmd.integrate', params);

      if (!res.ok) {
        throw new Error(res.error);
      }

      await pageContainer.setState({ // ???????????????????
        pageIdOnHackmd: res.pageIdOnHackmd,
        revisionIdHackmdSynced: res.revisionIdHackmdSynced,
      });
    }
    catch (err) {
      pageContainer.showErrorToastr(err);

      setHasError(true);
      setErrorMessage('GROWI server failed to connect to HackMD.');
      setErrorReason(err.toString());
    }

    setIsInitialized(true);
    setIsInitializing(false);
  }, [getHackmdUri, pageContainer, pageId]);

  // /**
  //  * Start to edit w/o any api request
  //  */
  // resumeToEdit() {
  //   this.setState({ isInitialized: true });
  // }

  const discardChanges = useCallback(async() => {
    const { pageId } = pageContainer.state;

    try {
      const res = await apiPost('/hackmd.discard', { pageId });

      if (!res.ok) {
        throw new Error(res.error);
      }

      pageContainer.setState({
        isHackmdDraftUpdatingInRealtime: false,
        hasDraftOnHackmd: false,
        pageIdOnHackmd: res.pageIdOnHackmd,
        remoteRevisionId: res.revisionIdHackmdSynced,
        revisionIdHackmdSynced: res.revisionIdHackmdSynced,
      });
    }
    catch (err) {
      logger.error(err);
      pageContainer.showErrorToastr(err);
    }
  }, [pageContainer]);

  /**
   * save and update state of containers
   * @param {string} markdown
   */
  const onSaveWithShortcut = useCallback(async(markdown) => {
    const optionsToSave = getOptionsToSave(isSlackEnabled, slackChannels, grant, grantGroupId, grantGroupName, pageTags);

    try {
      // disable unsaved warning
      editorContainer.disableUnsavedWarning();

      // eslint-disable-next-line no-unused-vars
      const { page, tags } = await pageContainer.save(markdown, editorMode, optionsToSave);
      logger.debug('success to save');

      pageContainer.showSuccessToastr();

      // update state of EditorContainer
      editorContainer.setState({ tags });
    }
    catch (error) {
      logger.error('failed to save', error);
      pageContainer.showErrorToastr(error);
    }
  }, [editorContainer, editorMode, grant, grantGroupId, grantGroupName, isSlackEnabled, pageContainer, pageTags, slackChannels]);

  /**
   * onChange event of HackmdEditor handler
   */
  const hackmdEditorChangeHandler = useCallback(async(body) => {
    const hackmdUri = getHackmdUri();

    if (hackmdUri == null) {
      // do nothing
      return;
    }

    // do nothing if contents are same
    if (pageContainer.state.markdown === body) {
      return;
    }

    // enable unsaved warning
    editorContainer.enableUnsavedWarning();

    const params = {
      pageId: pageContainer.state.pageId,
    };
    try {
      await apiPost('/hackmd.saveOnHackmd', params);
    }
    catch (err) {
      logger.error(err);
    }
  }, [editorContainer, getHackmdUri, pageContainer.state.markdown, pageContainer.state.pageId]);

  // penpalErrorOccuredHandler(error) {
  //   const { pageContainer, t } = this.props;

  //   pageContainer.showErrorToastr(error);

  //   this.setState({
  //     hasError: true,
  //     errorMessage: t('hackmd.fail_to_connect'),
  //     errorReason: error.toString(),
  //   });
  // }

  // renderPreInitContent() {
  //   const hackmdUri = this.getHackmdUri();
  //   const { pageContainer, t } = this.props;
  //   const {
  //     revisionId, revisionIdHackmdSynced, remoteRevisionId, pageId,
  //   } = pageContainer.state;
  //   const isPageNotFound = pageId == null;

  //   let content;

  //   /*
  //    * HackMD is not setup
  //    */
  //   if (hackmdUri == null) {
  //     content = (
  //       <div>
  //         <p className="text-center hackmd-status-label"><i className="fa fa-file-text"></i> { t('hackmd.not_set_up')}</p>
  //         {/* eslint-disable-next-line react/no-danger */}
  //         <p dangerouslySetInnerHTML={{ __html: t('hackmd.need_to_associate_with_growi_to_use_hackmd_refer_to_this') }} />
  //       </div>
  //     );
  //   }

  //   /*
  //   * used HackMD from NotFound Page
  //   */
  //   else if (isPageNotFound) {
  //     content = (
  //       <div className="text-center">
  //         <p className="hackmd-status-label">
  //           <i className="fa fa-file-text mr-2" />
  //           { t('hackmd.used_for_not_found') }
  //         </p>
  //         {/* eslint-disable-next-line react/no-danger */}
  //         <p dangerouslySetInnerHTML={{ __html: t('hackmd.need_to_make_page') }} />
  //       </div>
  //     );
  //   }
  //   /*
  //    * Resume to edit or discard changes
  //    */
  //   else if (this.isResume) {
  //     const isHackmdDocumentOutdated = revisionIdHackmdSynced !== remoteRevisionId;

  //     content = (
  //       <div>
  //         <p className="text-center hackmd-status-label"><i className="fa fa-file-text"></i> HackMD is READY!</p>
  //         <p className="text-center"><strong>{t('hackmd.unsaved_draft')}</strong></p>

  //         { isHackmdDocumentOutdated && (
  //           <div className="card border-warning">
  //             <div className="card-header bg-warning"><i className="icon-fw icon-info"></i> {t('hackmd.draft_outdated')}</div>
  //             <div className="card-body text-center">
  //               {t('hackmd.based_on_revision')}&nbsp;
  //               <a href={`?revision=${revisionIdHackmdSynced}`}><span className="badge badge-secondary">{revisionIdHackmdSynced.substr(-8)}</span></a>

  //               <div className="text-center mt-3">
  //                 <button
  //                   className="btn btn-link btn-view-outdated-draft p-0"
  //                   type="button"
  //                   disabled={this.state.isInitializing}
  //                   onClick={() => { return this.resumeToEdit() }}
  //                 >
  //                   {t('hackmd.view_outdated_draft')}
  //                 </button>
  //               </div>
  //             </div>
  //           </div>
  //         ) }

  //         { !isHackmdDocumentOutdated && (
  //           <div className="text-center hackmd-resume-button-container mb-3">
  //             <button
  //               className="btn btn-success btn-lg waves-effect waves-light"
  //               type="button"
  //               disabled={this.state.isInitializing}
  //               onClick={() => { return this.resumeToEdit() }}
  //             >
  //               <span className="btn-label"><i className="icon-fw icon-control-end"></i></span>
  //               <span className="btn-text">{t('hackmd.resume_to_edit')}</span>
  //             </button>
  //           </div>
  //         ) }

  //         <div className="text-center hackmd-discard-button-container mb-3">
  //           <button
  //             className="btn btn-outline-secondary btn-lg waves-effect waves-light"
  //             type="button"
  //             onClick={() => { return this.discardChanges() }}
  //           >
  //             <span className="btn-label"><i className="icon-fw icon-control-start"></i></span>
  //             <span className="btn-text">{t('hackmd.discard_changes')}</span>
  //           </button>
  //         </div>

  //       </div>
  //     );
  //   }
  //   /*
  //    * Start to edit
  //    */
  //   else {
  //     const isRevisionOutdated = revisionId !== remoteRevisionId;

  //     content = (
  //       <div>
  //         <p className="text-muted text-center hackmd-status-label"><i className="fa fa-file-text"></i> HackMD is READY!</p>
  //         <div className="text-center hackmd-start-button-container mb-3">
  //           <button
  //             className="btn btn-info btn-lg waves-effect waves-light"
  //             type="button"
  //             disabled={isRevisionOutdated || this.state.isInitializing}
  //             onClick={() => { return this.startToEdit() }}
  //           >
  //             <span className="btn-label"><i className="icon-fw icon-paper-plane"></i></span>
  //             {t('hackmd.start_to_edit')}
  //           </button>
  //         </div>
  //         <p className="text-center">{t('hackmd.clone_page_content')}</p>
  //       </div>
  //     );
  //   }

  //   return (
  //     <div className="hackmd-preinit d-flex justify-content-center align-items-center">
  //       {content}
  //     </div>
  //   );
  // }

  if (editorMode == null) {
    return null;
  }

  const hackmdUri = getHackmdUri();
  const {
    markdown, pageIdOnHackmd,
  } = pageContainer.state;


  let content;

  if (isInitialized) {
    content = (
      <HackmdEditor
        // ref={(c) => { this.hackmdEditor = c }}
        hackmdUri={hackmdUri}
        pageIdOnHackmd={pageIdOnHackmd}
        // initializationMarkdown={this.isResume ? null : markdown}
        onChange={hackmdEditorChangeHandler}
        onSaveWithShortcut={(document) => {
          onSaveWithShortcut(document);
        }}
        // onPenpalErrorOccured={this.penpalErrorOccuredHandler}
      >
      </HackmdEditor>
    );
  }
  else {
    // content = this.renderPreInitContent();
  }


  return (
    <div className="position-relative">

      {content}

      { hasError && (
        <div className="hackmd-error position-absolute d-flex flex-column justify-content-center align-items-center">
          <div className="bg-box p-5 text-center">
            <h2 className="text-warning"><i className="icon-fw icon-exclamation"></i> {t('hackmd.integration_failed')}</h2>
            <h4>{errorMessage}</h4>
            <p className="card well text-danger">
              {errorReason}
            </p>
            {/* eslint-disable-next-line react/no-danger */}
            <p dangerouslySetInnerHTML={{ __html: t('hackmd.check_configuration') }} />
          </div>
        </div>
      ) }

    </div>
  );

};

PageEditorByHackmd.propTypes = {
  t: PropTypes.func.isRequired, // i18next

  appContainer: PropTypes.instanceOf(AppContainer).isRequired,
  pageContainer: PropTypes.instanceOf(PageContainer).isRequired,
  editorContainer: PropTypes.instanceOf(EditorContainer).isRequired,

  // TODO: remove this when omitting unstated is completed
  editorMode: PropTypes.string.isRequired,
  isSlackEnabled: PropTypes.bool.isRequired,
  pageTags: PropTypes.arrayOf(PropTypes.string),
  slackChannels: PropTypes.string.isRequired,
  grant: PropTypes.number.isRequired,
  grantGroupId: PropTypes.string,
  grantGroupName: PropTypes.string,
};

const PageEditorByHackmdWrapper = withUnstatedContainers(PageEditorByHackmd, [AppContainer, PageContainer, EditorContainer]);

export default PageEditorByHackmdWrapper;
