import type { ColorScheme, IUser, IUserHasId } from '@growi/core';
import {
  DevidedPagePath, Lang, AllLang,
} from '@growi/core';
import { GetServerSideProps, GetServerSidePropsContext } from 'next';
import { SSRConfig, UserConfig } from 'next-i18next';

import * as nextI18NextConfig from '^/config/next-i18next.config';

import type { CrowiRequest } from '~/interfaces/crowi-request';

export type CommonProps = {
  namespacesRequired: string[], // i18next
  currentPathname: string,
  appTitle: string,
  siteUrl: string,
  confidential: string,
  customTitleTemplate: string,
  csrfToken: string,
  isContainerFluid: boolean,
  growiVersion: string,
  isMaintenanceMode: boolean,
  redirectDestination: string | null,
  isDefaultLogo: boolean,
  currentUser?: IUserHasId,
  forcedColorScheme?: ColorScheme,
} & Partial<SSRConfig>;

// eslint-disable-next-line max-len
export const getServerSideCommonProps: GetServerSideProps<CommonProps> = async(context: GetServerSidePropsContext) => {

  const req = context.req as CrowiRequest<IUserHasId & any>;
  const { crowi, user } = req;
  const {
    appService, configManager, customizeService, attachmentService,
  } = crowi;

  const url = new URL(context.resolvedUrl, 'http://example.com');
  const currentPathname = decodeURIComponent(url.pathname);

  const isMaintenanceMode = appService.isMaintenanceMode();

  let currentUser;
  if (user != null) {
    currentUser = user.toObject();
  }

  // Redirect destination for page transition by next/link
  let redirectDestination: string | null = null;
  if (!crowi.aclService.isGuestAllowedToRead() && currentUser == null) {
    redirectDestination = '/login';
  }
  else if (!isMaintenanceMode && currentPathname === '/maintenance') {
    redirectDestination = '/';
  }
  else if (isMaintenanceMode && !currentPathname.match('/admin/*') && !(currentPathname === '/maintenance')) {
    redirectDestination = '/maintenance';
  }
  else {
    redirectDestination = null;
  }

  const isCustomizedLogoUploaded = await attachmentService.isBrandLogoExist();
  const isDefaultLogo = crowi.configManager.getConfig('crowi', 'customize:isDefaultLogo') || !isCustomizedLogoUploaded;
  const forcedColorScheme = crowi.customizeService.forcedColorScheme;

  const props: CommonProps = {
    namespacesRequired: ['translation'],
    currentPathname,
    appTitle: appService.getAppTitle(),
    siteUrl: configManager.getConfig('crowi', 'app:siteUrl'), // DON'T USE appService.getSiteUrl()
    confidential: appService.getAppConfidential() || '',
    customTitleTemplate: customizeService.customTitleTemplate,
    csrfToken: req.csrfToken(),
    isContainerFluid: configManager.getConfig('crowi', 'customize:isContainerFluid') ?? false,
    growiVersion: crowi.version,
    isMaintenanceMode,
    redirectDestination,
    currentUser,
    isDefaultLogo,
    forcedColorScheme,
  };

  return { props };
};

export const getNextI18NextConfig = async(
    // 'serverSideTranslations' method should be given from Next.js Page
    //  because importing it in this file causes https://github.com/isaachinman/next-i18next/issues/1545
    serverSideTranslations: (
      initialLocale: string, namespacesRequired?: string[] | undefined, configOverride?: UserConfig | null, extraLocales?: string[] | false
    ) => Promise<SSRConfig>,
    context: GetServerSidePropsContext, namespacesRequired?: string[] | undefined, preloadAllLang = false,
): Promise<SSRConfig> => {

  const req: CrowiRequest = context.req as CrowiRequest;
  const { crowi, user, headers } = req;
  const { configManager } = crowi;

  // detect locale from browser accept language
  const acceptLanguages = headers['accept-language'];
  const browserLang = acceptLanguages?.split(',').shift();
  let detectLocale = 'en_US';
  if (browserLang?.includes('ja')) detectLocale = 'ja_JP';
  if (browserLang?.includes('zh')) detectLocale = 'zh_CN';

  // determine language
  const locale = user == null ? detectLocale
    : (user.lang ?? configManager.getConfig('crowi', 'app:globalLang') as Lang ?? Lang.en_US);

  const namespaces = ['commons'];
  if (namespacesRequired != null) {
    namespaces.push(...namespacesRequired);
  }
  // TODO: deprecate 'translation.json' in the future
  else {
    namespaces.push('translation');
  }

  return serverSideTranslations(locale, namespaces, nextI18NextConfig, preloadAllLang ? AllLang : false);
};

/**
 * Generate whole title string for the specified title
 * @param props
 * @param title
 */
export const generateCustomTitle = (props: CommonProps, title: string): string => {
  return props.customTitleTemplate
    .replace('{{sitename}}', props.appTitle)
    .replace('{{pagepath}}', title)
    .replace('{{pagename}}', title);
};

/**
 * Generate whole title string for the specified page path
 * @param props
 * @param pagePath
 */
export const generateCustomTitleForPage = (props: CommonProps, pagePath: string): string => {
  const dPagePath = new DevidedPagePath(pagePath, true, true);

  return props.customTitleTemplate
    .replace('{{sitename}}', props.appTitle)
    .replace('{{pagepath}}', pagePath)
    .replace('{{pagename}}', dPagePath.latter);
};
