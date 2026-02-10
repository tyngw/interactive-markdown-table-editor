/**
 * StatusBar.styles.test.tsx
 * StatusBar.stylesの全styled componentsのレンダリングとprop分岐を検証
 */

import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import {
  StatusBarContainer,
  StatusSection,
  StatusItem,
  GitDiffButton,
  GitDiffIcon,
  GitDiffLabel,
  StatusSelection,
  StatusMessage,
} from '../components/StatusBar.styles'

describe('StatusBar.styles', () => {
  describe('StatusBarContainer', () => {
    it('レンダリングできる', () => {
      const { container } = render(<StatusBarContainer>content</StatusBarContainer>)
      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('StatusSection', () => {
    it('align="left"でレンダリングできる', () => {
      const { container } = render(<StatusSection align="left">content</StatusSection>)
      expect(container.firstChild).toBeTruthy()
    })

    it('align="center"でレンダリングできる', () => {
      const { container } = render(<StatusSection align="center">content</StatusSection>)
      expect(container.firstChild).toBeTruthy()
    })

    it('align="right"でレンダリングできる', () => {
      const { container } = render(<StatusSection align="right">content</StatusSection>)
      expect(container.firstChild).toBeTruthy()
    })

    it('alignなし（default）でレンダリングできる', () => {
      const { container } = render(<StatusSection>content</StatusSection>)
      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('StatusItem', () => {
    it('レンダリングできる', () => {
      const { container } = render(<StatusItem>content</StatusItem>)
      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('GitDiffButton', () => {
    it('active=true でレンダリングできる', () => {
      const { container } = render(<GitDiffButton active>test</GitDiffButton>)
      expect(container.firstChild).toBeTruthy()
    })

    it('active=false でレンダリングできる', () => {
      const { container } = render(<GitDiffButton active={false}>test</GitDiffButton>)
      expect(container.firstChild).toBeTruthy()
    })

    it('disabled=true でレンダリングできる', () => {
      const { container } = render(<GitDiffButton active={false} disabled>test</GitDiffButton>)
      expect(container.firstChild).toBeTruthy()
    })

    it('disabled=false でレンダリングできる', () => {
      const { container } = render(<GitDiffButton active={false} disabled={false}>test</GitDiffButton>)
      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('GitDiffIcon', () => {
    it('レンダリングできる', () => {
      const { container } = render(<GitDiffIcon>icon</GitDiffIcon>)
      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('GitDiffLabel', () => {
    it('レンダリングできる', () => {
      const { container } = render(<GitDiffLabel>label</GitDiffLabel>)
      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('StatusSelection', () => {
    it('レンダリングできる', () => {
      const { container } = render(<StatusSelection>A1:B2</StatusSelection>)
      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('StatusMessage', () => {
    it('messageTypeなしでレンダリングできる', () => {
      const { container } = render(<StatusMessage>msg</StatusMessage>)
      expect(container.firstChild).toBeTruthy()
    })

    it('messageType="success"でレンダリングできる', () => {
      const { container } = render(<StatusMessage messageType="success">msg</StatusMessage>)
      expect(container.firstChild).toBeTruthy()
    })

    it('messageType="error"でレンダリングできる', () => {
      const { container } = render(<StatusMessage messageType="error">msg</StatusMessage>)
      expect(container.firstChild).toBeTruthy()
    })

    it('messageType="warning"でレンダリングできる', () => {
      const { container } = render(<StatusMessage messageType="warning">msg</StatusMessage>)
      expect(container.firstChild).toBeTruthy()
    })

    it('messageType="info"でレンダリングできる', () => {
      const { container } = render(<StatusMessage messageType="info">msg</StatusMessage>)
      expect(container.firstChild).toBeTruthy()
    })
  })
})
