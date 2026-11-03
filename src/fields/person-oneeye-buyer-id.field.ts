import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { PERSON_ONEEYE_BUYER_ID_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { FIELD_PERSON_BUYER_ID } from 'src/constants/config';

// The 1eye buyer id: the second step of person matching (after a stored Twenty id), and what makes
// a repeated push land on the same person.
export default defineField({
  universalIdentifier: PERSON_ONEEYE_BUYER_ID_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: FIELD_PERSON_BUYER_ID,
  type: FieldType.TEXT,
  label: '1eye Buyer ID',
  description: 'Identifier of this buyer in 1eye. Set by the 1eye app; do not edit.',
  icon: 'IconEye',
  // The app rewrites it only when it changes; keep the person timeline free of sync noise.
  isAuditLogged: false,
});
