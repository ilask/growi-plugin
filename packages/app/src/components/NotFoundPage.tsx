import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import { useCurrentPageId, useCurrentPagePath } from '~/stores/context';

import CustomNavAndContents from './CustomNavigation/CustomNavAndContents';
import { DescendantsPageListForCurrentPath } from './DescendantsPageList';
import PageListIcon from './Icons/PageListIcon';
import TimeLineIcon from './Icons/TimeLineIcon';
import PageTimeline from './PageTimeline';


const NotFoundPage = (): JSX.Element => {
  const { t } = useTranslation();
  const { data: pageId } = useCurrentPageId();
  const { data: path } = useCurrentPagePath();

  if (pageId != null) {
    window.history.replaceState(null, '', path);
  }

  const navTabMapping = useMemo(() => {
    return {
      pagelist: {
        Icon: PageListIcon,
        Content: DescendantsPageListForCurrentPath,
        i18n: t('page_list'),
        index: 0,
      },
      timeLine: {
        Icon: TimeLineIcon,
        Content: PageTimeline,
        i18n: t('Timeline View'),
        index: 1,
      },
    };
  }, [t]);


  return (
    <div className="d-edit-none">
      <CustomNavAndContents navTabMapping={navTabMapping} tabContentClasses={['py-4']} />
    </div>
  );
};

export default NotFoundPage;
