export type UserRole = 'student' | 'alumni' | 'faculty' | 'admin';
export type Permission = string; // Maybe union?

export const rolePermissions: Map<UserRole, Permission[]> = new Map([
  [
    'admin',
    [
      'profiles.manage', // Can view, update, delete any profile
      'user_roles.manage', // Can assign/remove roles
      'lookup_tables.manage', // Can manage industries, departments, interests
      'audit_logs.view', // Can view all audit logs
      'skills.manage', // Explicit permission for managing the skills lookup table
      'user_skills.manage_all', // Can manage all user skills 

      // Content Moderation
      'success_stories.manage', // Can approve, reject, delete
      'achievements.manage', // Can manage others' achievements (less common, but possible)
      'group_posts.moderate', // Can delete/edit any group post
      'group_post_comments.moderate', // Can delete/edit any comment
      'event_comments.moderate', // Can delete/edit any event comment

      // Event Management
      'events.manage', // Can create, update, delete any event
      'event_registrations.view_all', // Can view all registrations for an event

      // Group Management
      'groups.manage', // Can create, update, delete any group
      'group_memberships.manage_all', // Can approve/reject any membership request, remove anyone

      // 'user_connections.view_all', // Potentially for auditing
      // 'rooms.view_all', // Potentially for auditing
      // 'messages.view_all', // Potentially for auditing
    ],
  ],
  [
    'faculty',
    [
      // Profile Management
      'self_profile.view', // Can view their own profile
      'self_profile.update', // Can update their own profile
      'faculty_profile.view', // Can view faculty-specific fields on their profile
      'faculty_profile.update', // Can update faculty-specific fields

      // Directory/Networking
      'profiles.view', // Can view other basic profiles
      'experiences.view', // Can view others' experiences
      'education.view', // Can view others' education
      'achievements.view', // Can view others' achievements
      'user_interests.view', // Can view others' interests
      'user_industries.view', // Can view others' industries
      'user_connections.view_self', // Can view their own connections

      // Events
      'events.view', // Can view events
      'events.register', // Can register for events
      'events.comment', // Can comment on events
      // 'events.create_official', // Can create official faculty/department events
      // 'event_registrations.view_own', // Can view who registered for their own events

      // Groups
      'groups.view', // Can view public/joined groups
      'groups.join', // Can join public groups
      'groups.request_join', // Can request to join approval groups
      'group_memberships.view_self', // Can view their own group memberships
      'group_posts.view', // Can view posts in joined groups
      'group_posts.create', // Can post in joined groups
      'group_post_comments.view', // Can view comments in joined groups
      'group_post_comments.create', // Can comment in joined groups
      // 'groups.create_official', // Can create official faculty groups
      // 'group_memberships.manage_official_groups', // Manage memberships in their official groups

      // Success Stories/Achievements
      'success_stories.view', // Can view approved success stories
      'achievements.view', // Can view others' achievements
      'self_achievements.manage', // Can manage their own achievements

      'skills.view', // Can view skills lookup table
      'user_skills.view', // Can view others' linked skills
      'self_user_skills.manage',

      // Messaging
      'messages.send', // Can send direct messages
      'messages.view', // Can view messages in rooms they are part of
      'rooms.view_self', // Can view rooms they are part of
      'user_connections.send_request', // Can send connection requests
      'user_connections.accept_request', // Can accept/reject requests
      'user_connections.delete_self', // Can remove connections
    ],
  ],
  [
    'alumni',
    [
      // Profile Management
      'self_profile.view',
      'self_profile.update',
      'student_alumni_profile.view_alumni_fields', // Can view their alumni-specific fields
      'student_alumni_profile.update_alumni_fields', // Can update their alumni-specific fields
      'experiences.manage_self', // Can manage their own experiences
      'education.manage_self', // Can manage their own education

      // Directory/Networking
      'profiles.view',
      'experiences.view',
      'education.view',
      'achievements.view',
      'user_interests.view',
      'user_industries.view',
      'user_connections.view_self',

      // Events
      'events.view',
      'events.register',
      'events.comment',

      // Groups
      'groups.view',
      'groups.join',
      'groups.request_join',
      'group_memberships.view_self',
      'group_posts.view',
      'group_posts.create',
      'group_post_comments.view',
      'group_post_comments.create',
      // Optional: 'groups.create_alumni', // Can create general alumni groups

      // Success Stories/Achievements
      'success_stories.view',
      'success_stories.submit', // Can submit a success story
      'achievements.view',
      'self_achievements.manage',

      'skills.view', // Can view skills lookup table
      'user_skills.view', // Can view others' linked skills
      'self_user_skills.manage',

      // Messaging
      'messages.send',
      'messages.view',
      'rooms.view_self',
      'user_connections.send_request',
      'user_connections.accept_request',
      'user_connections.delete_self',
    ],
  ],
  [
    'student',
    [
      // Profile Management
      'self_profile.view',
      'self_profile.update',
      'student_alumni_profile.view_student_fields', // Can view their student-specific fields
      'student_alumni_profile.update_student_fields', // Can update their student-specific fields
      'experiences.manage_self', // Can manage their own experiences (
      'education.manage_self', // Can manage their own education

      // Directory/Networking
      'profiles.view',
      'experiences.view',
      'education.view',
      'achievements.view',
      'user_interests.view',
      'user_industries.view',
      'user_connections.view_self',

      // Events
      'events.view',
      'events.register',
      'events.comment',

      // Groups
      'groups.view',
      'groups.join',
      'groups.request_join',
      'group_memberships.view_self',
      'group_posts.view',
      'group_posts.create',
      'group_post_comments.view',
      'group_post_comments.create',

      // Success Stories/Achievements
      'success_stories.view', // Can view approved success stories
      'achievements.view', // Can view others' achievements
      'self_achievements.manage',
      'skills.view', // Can view skills lookup table
      'user_skills.view', // Can view others' linked skills
      'self_user_skills.manage',

      // Messaging
      'messages.send',
      'messages.view',
      'rooms.view_self',
      'user_connections.send_request',
      'user_connections.accept_request',
      'user_connections.delete_self',
    ],
  ],
]);

/**
 * Gets the list of permissions for a specific role.
 * If a user has multiple roles, you would typically combine the permissions
 * from all their roles for authorization checks.
 * @param role The user role
 * @returns An array of permission strings.
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return rolePermissions.get(role) || [];
}

/**
 * Checks if a user with a specific role has a given permission.
 * Note: For users with multiple roles, you would check if *any* of their
 * roles grants the permission. This function checks for a single role.
 * @param role The user role.
 * @param permission The permission string to check for.
 * @returns True if the role has the permission, false otherwise.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

// --- Example Usage (for a user with multiple roles) ---

/**
 * Gets all unique permissions for a user based on all their assigned roles.
 * @param userRoles An array of roles assigned to the user.
 * @returns A unique set of permissions.
 */
export function getAllPermissionsForUser(userRoles: UserRole[]): Set<Permission> {
  const allPermissions = new Set<Permission>();
  userRoles.forEach(role => {
    const permissions = getPermissionsForRole(role);
    permissions.forEach(perm => allPermissions.add(perm));
  });
  return allPermissions;
}

/**
 * Checks if a user with the given roles has a specific permission.
 * @param userRoles An array of roles assigned to the user.
 * @param permission The permission string to check for.
 * @returns True if any of the user's roles grants the permission, false otherwise.
 */
export function userHasPermission(userRoles: UserRole[], permission: Permission): boolean {
  const permissions = getAllPermissionsForUser(userRoles);
  return permissions.has(permission);
}

// Assuming 'currentUserRoles' is an array like ['alumni', 'faculty']
// userHasPermission(currentUserRoles, 'events.create_official') // Would be true if either alumni or faculty roles had this perm