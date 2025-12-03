// ============================================
// Contacts-specific mapping logic
// Maps Notion properties to Supabase schema
// ============================================

// Extract value from Notion property based on type
export function extractNotionPropertyValue(property: any): any {
  const type = property?.type
  if (!type) return null

  switch (type) {
    case 'title':
      return property.title?.[0]?.plain_text || ''
    case 'rich_text':
      return property.rich_text?.[0]?.plain_text || null
    case 'email':
      return property.email || null
    case 'phone_number':
      return property.phone_number || null
    case 'url':
      return property.url || null
    case 'number':
      return property.number
    case 'checkbox':
      return property.checkbox
    case 'date':
      return property.date?.start || null
    case 'select':
      return property.select?.name || null
    case 'multi_select':
      // Return array of selected option names
      return property.multi_select?.map((s: any) => s.name) || []
    case 'status':
      return property.status?.name || null
    case 'relation':
      // Return array of related page IDs
      return property.relation?.map((r: any) => r.id) || []
    default:
      // Complex types - return raw for JSONB
      return property
  }
}

// Map Notion properties to Supabase contacts record
export async function mapNotionContactToRecord(
  page: any,
  supabase: any,
  orgMap?: Map<string, string> // Optional map of notion_id -> UUID for performance
): Promise<Record<string, any>> {
  const props = page.properties

  // Start with base fields
  const record: Record<string, any> = {
    notion_id: page.id,
    last_edited_time: page.last_edited_time,
    synced_from_notion_at: new Date().toISOString(),
    notion_properties: props, // Full backup
  }

  // Name (title property)
  if (props.Name) {
    record.name = extractNotionPropertyValue(props.Name)
  }

  // Work Email - map to BOTH email and work_email (both optional)
  // Note: Email is NOT unique - multiple people can share one email
  if (props['Work Email']) {
    const emailValue = extractNotionPropertyValue(props['Work Email'])?.toLowerCase()
    if (emailValue) {
      record.email = emailValue  // Primary email field (optional)
      record.work_email = emailValue  // Also store in work_email for compatibility
    }
  }

  // Work Phone Number
  if (props['Work Phone Number']) {
    record.work_phone_number = extractNotionPropertyValue(props['Work Phone Number'])
  }

  // Role/Title
  if (props['Role/Title']) {
    record.role_title = extractNotionPropertyValue(props['Role/Title'])
  }

  // Contact Type (multi_select - returns array)
  if (props['Contact Type']) {
    record.contact_type = extractNotionPropertyValue(props['Contact Type'])
  }

  // Dietary Restrictions
  if (props['Dietary Restrictions']) {
    record.dietary_restrictions = extractNotionPropertyValue(props['Dietary Restrictions'])
  }

  // Profile Picture (URL)
  if (props['Profile Picture']) {
    record.profile_picture_url = extractNotionPropertyValue(props['Profile Picture'])
  }

  // vCard URL (for QR scanning)
  if (props.vCard) {
    record.vcard_url = extractNotionPropertyValue(props.vCard)
  }

  // Organization (relation) - CRITICAL: resolve to UUID
  if (props.Organization) {
    const orgNotionIds = extractNotionPropertyValue(props.Organization)
    if (orgNotionIds && orgNotionIds.length > 0) {
      const orgNotionId = orgNotionIds[0]

      // Use cached map if available (performance optimization)
      if (orgMap) {
        record.organization_id = orgMap.get(orgNotionId) || null
      } else {
        // Fallback to database lookup (slower)
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('notion_id', orgNotionId)
          .single()

        if (org) {
          record.organization_id = org.id
        }
      }
    }
  }

  // Personal Tag (relation) - store as array of Notion IDs
  if (props['Personal Tag']) {
    record.personal_tag_ids = extractNotionPropertyValue(props['Personal Tag'])
  }

  return record
}

// Build Notion properties from Supabase record (for syncing back)
export function buildNotionContactProperties(record: any): any {
  const properties: any = {}

  // Name (required title field)
  if (record.name) {
    properties.Name = {
      title: [{ text: { content: record.name } }]
    }
  }

  // Work Email
  if (record.work_email) {
    properties['Work Email'] = {
      email: record.work_email
    }
  }

  // Work Phone Number
  if (record.work_phone_number) {
    properties['Work Phone Number'] = {
      phone_number: record.work_phone_number
    }
  }

  // Role/Title
  if (record.role_title) {
    properties['Role/Title'] = {
      rich_text: [{ text: { content: record.role_title } }]
    }
  }

  // Contact Type
  if (record.contact_type) {
    properties['Contact Type'] = {
      select: { name: record.contact_type }
    }
  }

  // Dietary Restrictions
  if (record.dietary_restrictions) {
    properties['Dietary Restrictions'] = {
      rich_text: [{ text: { content: record.dietary_restrictions } }]
    }
  }

  // Profile Picture
  if (record.profile_picture_url) {
    properties['Profile Picture'] = {
      url: record.profile_picture_url
    }
  }

  // vCard
  if (record.vcard_url) {
    properties.vCard = {
      url: record.vcard_url
    }
  }

  // Organization - convert UUID back to Notion relation
  // TODO: Need to look up organization's notion_id by UUID
  // if (record.organization_id) {
  //   properties.Organization = {
  //     relation: [{ id: organization_notion_id }]
  //   }
  // }

  // Personal Tags - array of Notion page IDs
  if (record.personal_tag_ids && record.personal_tag_ids.length > 0) {
    properties['Personal Tag'] = {
      relation: record.personal_tag_ids.map((id: string) => ({ id }))
    }
  }

  return properties
}
