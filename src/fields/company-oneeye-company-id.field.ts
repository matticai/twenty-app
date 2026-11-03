import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { COMPANY_ONEEYE_COMPANY_ID_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { FIELD_COMPANY_ID } from 'src/constants/config';

export default defineField({
  universalIdentifier: COMPANY_ONEEYE_COMPANY_ID_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  name: FIELD_COMPANY_ID,
  type: FieldType.TEXT,
  label: '1eye Company ID',
  description: 'Identifier of this company in 1eye. Set by the 1eye app; do not edit.',
  icon: 'IconEye',
  isAuditLogged: false,
});
