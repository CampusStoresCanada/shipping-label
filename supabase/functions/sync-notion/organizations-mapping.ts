// Organizations-specific mapping logic
import { extractNotionPropertyValue } from './contacts-mapping.ts'

export async function mapNotionOrganizationToRecord(
  page: any,
  supabase: any
): Promise<Record<string, any>> {
  const props = page.properties

  const record: Record<string, any> = {
    notion_id: page.id,
    last_edited_time: page.last_edited_time,
    synced_from_notion_at: new Date().toISOString(),
    notion_properties: props,
  }

  // Organization name (title)
  if (props.Organization) {
    record.organization = extractNotionPropertyValue(props.Organization)
  }

  // Organization Type (select)
  if (props['Organization Type']) {
    record.organization_type = extractNotionPropertyValue(props['Organization Type'])
  }

  // Primary Category (select)
  if (props['Primary Category']) {
    record.primary_category = extractNotionPropertyValue(props['Primary Category'])
  }

  // Province (select)
  if (props.Province) {
    record.province = extractNotionPropertyValue(props.Province)
  }

  // Website (url)
  if (props.Website) {
    record.website = extractNotionPropertyValue(props.Website)
  }

  // Join Date (date)
  if (props['Join Date']) {
    record.join_date = extractNotionPropertyValue(props['Join Date'])
  }

  // Address fields
  if (props['Street Address']) {
    record.street_address = extractNotionPropertyValue(props['Street Address'])
  }
  if (props.City) {
    record.city = extractNotionPropertyValue(props.City)
  }
  if (props['Postal Code']) {
    record.postal_code = extractNotionPropertyValue(props['Postal Code'])
  }

  // FTE (number)
  if (props.FTE) {
    record.fte = extractNotionPropertyValue(props.FTE)
  }

  // Tag (relation - array)
  if (props.Tag) {
    record.tag_ids = extractNotionPropertyValue(props.Tag)
  }

  // Contacts (relation - array)
  if (props.Contacts) {
    record.contact_ids = extractNotionPropertyValue(props.Contacts)
  }

  return record
}

export function buildNotionOrganizationProperties(record: any): any {
  const properties: any = {}

  if (record.organization) {
    properties.Organization = {
      title: [{ text: { content: record.organization } }]
    }
  }

  if (record.organization_type) {
    properties['Organization Type'] = {
      select: { name: record.organization_type }
    }
  }

  if (record.primary_category) {
    properties['Primary Category'] = {
      select: { name: record.primary_category }
    }
  }

  if (record.province) {
    properties.Province = {
      select: { name: record.province }
    }
  }

  if (record.website) {
    properties.Website = {
      url: record.website
    }
  }

  if (record.join_date) {
    properties['Join Date'] = {
      date: { start: record.join_date }
    }
  }

  return properties
}
