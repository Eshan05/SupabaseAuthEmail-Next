'use client'

import Image from 'next/image'
import { Breadcrumbs } from './breadcrumbs'
import { ModeToggle } from '../mode-toggle'

export default function Navigation() {
  return (
    <nav className='sm:max-w-sm max-w-[350px] rounded-lg fixed top-4 left-1/2 -translate-x-1/2 z-30 flex md:max-w-md lg:max-w-lg items-center justify-between border bg-background/50 backdrop-blur-lg mx-auto py-4 px-4 shadow w-full'>
      <Breadcrumbs />
      <div className='flex items-center gap-2'>
        <ModeToggle />
        <Image
          src='https://res.cloudinary.com/dygc8r0pv/image/upload/v1734452294/ACES_Logo_ACE_White_d6rz6a.png'
          width={30}
          height={30}
          className='drop-shadow-lg max-h-7 max-w-7 rounded hidden'
          quality={100}
          alt='Logo'
        />
      </div>
    </nav>
  )
}
