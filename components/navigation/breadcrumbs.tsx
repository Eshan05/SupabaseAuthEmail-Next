'use client'

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HomeIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

interface BreadcrumbItemType {
  href: string
  label: React.ReactNode
  isCurrentPage: boolean
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const pathSegments = pathname.split('/').filter((segment) => segment !== '')

  const Slugs: Record<string, string> = {
    profile: 'Profile',
  }

  const breadcrumbs: BreadcrumbItemType[] = [
    { href: '/', label: <><HomeIcon className='h-4 w-4' /><span className="sr-only">Home</span></>, isCurrentPage: false },
    ...pathSegments.map((segment, index) => {
      const href = `/${pathSegments.slice(0, index + 1).join('/')}`
      let label =
        Slugs[segment] ||
        segment
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      if (index > 0 && Slugs[pathSegments[index - 1]]) {
        label = Slugs[pathSegments[index - 1]]
      }
      return {
        href,
        label,
        isCurrentPage: index === pathSegments.length - 1,
      }
    }),
  ]

  const overflow = breadcrumbs.length > 2

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((breadcrumb, index) => {
          if (overflow && index === 1) {
            return (
              <React.Fragment key={breadcrumb.href}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger className='flex items-center gap-1 cursor-pointer'>
                      <BreadcrumbEllipsis className='h-4 w-4' />
                      <span className='sr-only'>Toggle menu</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='start'>
                      {breadcrumbs.slice(1, -1).map((item) => (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link
                            href={item.href}
                            className='text-base font-semibold leading-none tracking-tight'
                          >
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </BreadcrumbItem>
              </React.Fragment>
            )
          }

          if (overflow && index > 1 && index < breadcrumbs.length - 1) {
            return null
          }

          return (
            <React.Fragment key={breadcrumb.href}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {breadcrumb.isCurrentPage ? (
                  <BreadcrumbPage className='text-base small-caps font-medium leading-none tracking-tight'>
                    {breadcrumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      href={breadcrumb.href}
                      className='text-base font-medium small-caps leading-none tracking-tight'
                    >
                      {breadcrumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
