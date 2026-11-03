import { defineSettingsMenuItem } from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  SETTINGS_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineSettingsMenuItem({
  universalIdentifier: SETTINGS_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier: SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  title: APP_DISPLAY_NAME,
  icon: 'IconEye',
  position: 100,
});
