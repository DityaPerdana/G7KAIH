import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a teacher or parent
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('roleid')
      .eq('userid', user.id)
      .single()

    const { data: role } = await supabase
      .from('role')
      .select('rolename')
      .eq('roleid', userProfile?.roleid)
      .single()

    if (!role || !['teacher', 'parent'].includes(role.rolename)) {
      return NextResponse.json({ error: 'Forbidden - Only teachers and parents can validate activities' }, { status: 403 })
    }

    const body = await request.json()
    const { field_value_id, validated_by_teacher, validated_by_parent } = body

    if (!field_value_id) {
      return NextResponse.json({ error: 'field_value_id is required' }, { status: 400 })
    }

    // Prepare update data based on user role
    const updateData: any = {}
    if (role.rolename === 'teacher' && validated_by_teacher !== undefined) {
      updateData.isvalidatebyteacher = validated_by_teacher
    } else if (role.rolename === 'parent' && validated_by_parent !== undefined) {
      updateData.isvalidatebyparent = validated_by_parent
    } else {
      return NextResponse.json({ error: 'Invalid validation request' }, { status: 400 })
    }

    // Update the field value validation status
    const { data, error } = await supabase
      .from('aktivitas_field_values')
      .update(updateData)
      .eq('id', field_value_id)
      .select()

    if (error) {
      console.error('Error updating validation:', error)
      return NextResponse.json({ error: 'Failed to update validation status' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data[0],
      message: `Validation ${role.rolename === 'teacher' ? 'by teacher' : 'by parent'} updated successfully`
    })

  } catch (error) {
    console.error('Error in validation API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
