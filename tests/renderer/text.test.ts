import { describe, it, expect } from 'vitest'
import { parseAddresses, initials } from '../../src/renderer/src/lib/text'

describe('text', () => {
  it('parse "Nom <mail>"', () => {
    expect(parseAddresses('"Jean Dupont" <jean@x.fr>, bob@y.fr')).toEqual([{ name: 'Jean Dupont', address: 'jean@x.fr' }, { name: '', address: 'bob@y.fr' }])
  })
  it('initiales', () => { expect(initials({ name: 'Jean Dupont', address: '' })).toBe('JD') })
})
