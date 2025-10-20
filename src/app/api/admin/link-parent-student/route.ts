import { getParentRoleIds, getStudentRoleIds, isParentRole, isStudentRole } from '@/utils/lib/roles'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { parentId, studentId } = await request.json()
    
    if (!parentId || !studentId) {
      return NextResponse.json({ 
        error: 'Both parentId and studentId are required' 
      }, { status: 400 })
    }

    const adminClient = await createAdminClient()

    const parentRoleIds = getParentRoleIds()

    // Verify parent exists and has correct role
    const { data: parent, error: parentError } = await adminClient
      .from('user_profiles')
      .select('userid, username, roleid')
      .eq('userid', parentId)
      .in('roleid', parentRoleIds.length > 0 ? parentRoleIds : [-1])
      .single()

    if (parentError || !parent) {
      return NextResponse.json({ 
        error: 'Parent not found or invalid role',
        debug: { parentId, parentError }
      }, { status: 404 })
    }

    // Verify student exists and has correct role
    const studentRoleIds = getStudentRoleIds()

    const { data: student, error: studentError } = await adminClient
      .from('user_profiles')
      .select('userid, username, roleid')
      .eq('userid', studentId)
      .in('roleid', studentRoleIds.length ? studentRoleIds : [-1])
      .single()

    if (studentError || !student || !isStudentRole(student.roleid)) {
      return NextResponse.json({ 
        error: 'Student not found or invalid role',
        debug: { studentId, studentError }
      }, { status: 404 })
    }

    // Update parent profile to link to student
    const { data: updatedParent, error: updateError } = await adminClient
      .from('user_profiles')
      .update({ parent_of_userid: studentId })
      .eq('userid', parentId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ 
        error: 'Failed to create parent-student relationship',
        debug: updateError
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Parent-student relationship created successfully',
      data: {
        parent: {
          id: parent.userid,
          name: parent.username
        },
        student: {
          id: student.userid,
          name: student.username
        },
        relationship: updatedParent
      }
    })

  } catch (error) {
    console.error('Link parent-student error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const adminClient = await createAdminClient()

    // Get all users with their roles
    const { data: allUsers, error } = await adminClient
      .from('user_profiles')
      .select('userid, username, roleid, parent_of_userid')
      .order('roleid', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const parents = allUsers?.filter(user => isParentRole(user.roleid)) || []
    const students = allUsers?.filter(user => isStudentRole(user.roleid)) || []
    const existingRelationships = parents.filter(parent => parent.parent_of_userid)

    return NextResponse.json({
      success: true,
      data: {
        parents,
        students,
        existingRelationships,
        availableParents: parents.filter(parent => !parent.parent_of_userid),
        availableStudents: students.filter(student => 
          !parents.some(parent => parent.parent_of_userid === student.userid)
        )
      }
    })

  } catch (error) {
    console.error('Get relationships error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
