import type { AgentInfo, AgentSpawnInput, On } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

const SECURITY = 'autopilot:security-engineer'
const FABLE = 'claude-fable-5-1'
const OPUS = 'claude-opus-5-5'
const FABLE_REASON =
  'Autopilot: security-engineer is not dispatched from a Fable session; tell the user and recommend restarting the job on opus.'
const NESTED_REASON =
  'Autopilot: autopilot roles never spawn agents; finish your own task and report back, and the orchestrator dispatches any follow-up work.'

const offerOf = (agent: string) => ({
  agent,
  description: 'test agent',
  source: 'plugin',
  provider: { plugin: 'autopilot', tier: 'user' as const },
})

const spawnOf = (fields: Partial<AgentSpawnInput>): AgentSpawnInput => ({
  tool_use_id: 'toolu_test',
  prompt: 'do the task',
  description: 'task',
  subagentType: 'autopilot:engineer',
  provider: { plugin: 'autopilot', tier: 'user' },
  parentModel: OPUS,
  background: false,
  fork: false,
  ...fields,
})

const agentOf = (id: string, type: string): AgentInfo => ({
  id,
  type,
  description: type,
  status: 'running',
})

type World = {
  model?: string
  modelDeny?: boolean
  agents?: AgentInfo[]
  agentsValue?: unknown
}

// The engine beneath the plugin: records what reached it.
function world(on: On, w: World) {
  const seen = { modelCalls: 0, listCalls: 0, offers: 0, spawns: [] as AgentSpawnInput[], toasts: [] as string[] }
  on('session.model', () => {
    seen.modelCalls++
    return w.modelDeny ? { deny: 'no model' } : { value: w.model ?? OPUS }
  })
  on('agent.offer', () => {
    seen.offers++
    return { isOffered: true }
  })
  on('agent.spawn', ($, e) => {
    seen.spawns.push(e)
    return { model: OPUS, agentId: 'child-1' }
  })
  on('agent.list', () => {
    seen.listCalls++
    return { value: (w.agentsValue ?? w.agents ?? []) as AgentInfo[] }
  })
  on('ui.toast', ($, e) => {
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  return seen
}

describe('agent.offer: Fable gate', () => {
  for (const enforcement of ['advisory', 'strict']) {
    test(`hides security-engineer on a Fable session (${enforcement})`, { options: { enforcement } }, async ($, on) => {
      const seen = world(on, { model: FABLE })
      expect(await $.agent.offer(offerOf(SECURITY))).toEqual({ isOffered: false })
      expect(seen.offers).toBe(0)
    })
  }

  test('matches the model name case-insensitively', { options: { enforcement: 'strict' } }, async ($, on) => {
    world(on, { model: 'Claude Fable 5.1' })
    expect(await $.agent.offer(offerOf(SECURITY))).toEqual({ isOffered: false })
  })

  test('offers security-engineer on an opus session', async ($, on) => {
    const seen = world(on, { model: OPUS })
    expect(await $.agent.offer(offerOf(SECURITY))).toEqual({ isOffered: true })
    expect(seen.offers).toBe(1)
  })

  test('offers other roles on a Fable session without asking for the model', async ($, on) => {
    const seen = world(on, { model: FABLE })
    expect(await $.agent.offer(offerOf('autopilot:engineer'))).toEqual({ isOffered: true })
    expect(seen.modelCalls).toBe(0)
  })

  test('off registers no enforcement hooks', { options: { enforcement: 'off' } }, async ($, on) => {
    const seen = world(on, { model: FABLE })
    expect(await $.agent.offer(offerOf(SECURITY))).toEqual({ isOffered: true })
    expect(await $.agent.spawn(spawnOf({ subagentType: SECURITY, parentModel: FABLE, parentAgentId: 'p1' }))).toEqual({
      model: OPUS,
      agentId: 'child-1',
    })
    expect(seen.modelCalls).toBe(0)
    expect(seen.listCalls).toBe(0)
    expect(seen.toasts).toEqual([])
  })

  test('an unknown enforcement value acts as advisory', { options: { enforcement: 'STRICT' } }, async ($, on) => {
    const seen = world(on, { model: FABLE })
    expect(await $.agent.offer(offerOf(SECURITY))).toEqual({ isOffered: false })
    const result = await $.agent.spawn(spawnOf({ subagentType: SECURITY, parentModel: FABLE }))
    expect(result.deny).toBeUndefined()
    expect(seen.toasts).toEqual([FABLE_REASON])
  })

  test('fails open when the session model cannot be read', { options: { enforcement: 'strict' } }, async ($, on) => {
    const seen = world(on, { modelDeny: true })
    expect(await $.agent.offer(offerOf(SECURITY))).toEqual({ isOffered: true })
    expect(seen.offers).toBe(1)
  })
})

describe('agent.spawn: Fable backstop', () => {
  test('strict denies security-engineer from a Fable parent', { options: { enforcement: 'strict' } }, async ($, on) => {
    const seen = world(on, {})
    expect(await $.agent.spawn(spawnOf({ subagentType: SECURITY, parentModel: FABLE }))).toEqual({ deny: FABLE_REASON })
    expect(seen.spawns).toHaveLength(0)
  })

  test('advisory warns and lets the spawn through', { options: { enforcement: 'advisory' } }, async ($, on) => {
    const seen = world(on, {})
    const result = await $.agent.spawn(spawnOf({ subagentType: SECURITY, parentModel: FABLE }))
    expect(result).toEqual({ model: OPUS, agentId: 'child-1' })
    expect(seen.toasts).toEqual([FABLE_REASON])
    expect(seen.spawns).toHaveLength(1)
  })

  test('the default enforcement is advisory', async ($, on) => {
    const seen = world(on, {})
    const result = await $.agent.spawn(spawnOf({ subagentType: SECURITY, parentModel: FABLE }))
    expect(result.deny).toBeUndefined()
    expect(seen.toasts).toEqual([FABLE_REASON])
  })

  test('strict allows security-engineer from an opus parent', { options: { enforcement: 'strict' } }, async ($, on) => {
    const seen = world(on, {})
    expect(await $.agent.spawn(spawnOf({ subagentType: SECURITY, parentModel: OPUS }))).toEqual({
      model: OPUS,
      agentId: 'child-1',
    })
    expect(seen.toasts).toEqual([])
    expect(seen.listCalls).toBe(0)
  })

  test('strict allows other roles from a Fable parent', { options: { enforcement: 'strict' } }, async ($, on) => {
    const seen = world(on, {})
    const result = await $.agent.spawn(spawnOf({ subagentType: 'autopilot:verifier', parentModel: FABLE }))
    expect(result.deny).toBeUndefined()
    expect(seen.spawns).toHaveLength(1)
  })
})

describe('agent.spawn: nested-spawn backstop', () => {
  const agents = [
    agentOf('role-1', 'autopilot:engineer'),
    agentOf('gp-1', 'general-purpose'),
    agentOf('lookalike-1', 'other-plugin:autopilot-helper'),
  ]

  test('strict denies a spawn from inside an autopilot role', { options: { enforcement: 'strict' } }, async ($, on) => {
    const seen = world(on, { agents })
    expect(await $.agent.spawn(spawnOf({ subagentType: 'Explore', parentAgentId: 'role-1' }))).toEqual({
      deny: NESTED_REASON,
    })
    expect(seen.spawns).toHaveLength(0)
  })

  test('advisory warns about a spawn from inside an autopilot role', { options: { enforcement: 'advisory' } }, async ($, on) => {
    const seen = world(on, { agents })
    const result = await $.agent.spawn(spawnOf({ subagentType: 'Explore', parentAgentId: 'role-1' }))
    expect(result).toEqual({ model: OPUS, agentId: 'child-1' })
    expect(seen.toasts).toEqual([NESTED_REASON])
  })

  test('strict allows a spawn from a non-autopilot subagent', { options: { enforcement: 'strict' } }, async ($, on) => {
    const seen = world(on, { agents })
    const result = await $.agent.spawn(spawnOf({ subagentType: 'Explore', parentAgentId: 'gp-1' }))
    expect(result.deny).toBeUndefined()
    expect(seen.spawns).toHaveLength(1)
  })

  test('strict allows a spawn from a type that only mentions autopilot', { options: { enforcement: 'strict' } }, async ($, on) => {
    const seen = world(on, { agents })
    const result = await $.agent.spawn(spawnOf({ subagentType: 'Explore', parentAgentId: 'lookalike-1' }))
    expect(result.deny).toBeUndefined()
    expect(seen.spawns).toHaveLength(1)
  })

  test('strict allows a spawn whose parent is not listed', { options: { enforcement: 'strict' } }, async ($, on) => {
    const seen = world(on, { agents })
    const result = await $.agent.spawn(spawnOf({ subagentType: 'Explore', parentAgentId: 'workflow-9' }))
    expect(result.deny).toBeUndefined()
    expect(seen.spawns).toHaveLength(1)
  })

  test('a spawn from the main loop never looks up agents', { options: { enforcement: 'strict' } }, async ($, on) => {
    const seen = world(on, { agents })
    const result = await $.agent.spawn(spawnOf({ subagentType: 'autopilot:engineer' }))
    expect(result.deny).toBeUndefined()
    expect(seen.listCalls).toBe(0)
  })

  test('strict names the Fable rule first when both apply', { options: { enforcement: 'strict' } }, async ($, on) => {
    world(on, { agents })
    const result = await $.agent.spawn(spawnOf({ subagentType: SECURITY, parentModel: FABLE, parentAgentId: 'role-1' }))
    expect(result).toEqual({ deny: FABLE_REASON })
  })

  test('advisory raises both warnings when both apply', { options: { enforcement: 'advisory' } }, async ($, on) => {
    const seen = world(on, { agents })
    const result = await $.agent.spawn(spawnOf({ subagentType: SECURITY, parentModel: FABLE, parentAgentId: 'role-1' }))
    expect(result.deny).toBeUndefined()
    expect(seen.toasts).toEqual([FABLE_REASON, NESTED_REASON])
  })
})

describe('agent.spawn: malformed input falls through', () => {
  test('an agent list that is not an array', { options: { enforcement: 'strict' } }, async ($, on) => {
    const seen = world(on, { agentsValue: { not: 'a list' } })
    const result = await $.agent.spawn(spawnOf({ subagentType: 'Explore', parentAgentId: 'role-1' }))
    expect(result).toEqual({ model: OPUS, agentId: 'child-1' })
    expect(seen.spawns).toHaveLength(1)
  })

  test('an agent list entry with no type', { options: { enforcement: 'strict' } }, async ($, on) => {
    const seen = world(on, { agentsValue: [{ id: 'role-1' }] })
    const result = await $.agent.spawn(spawnOf({ subagentType: 'Explore', parentAgentId: 'role-1' }))
    expect(result.deny).toBeUndefined()
    expect(seen.spawns).toHaveLength(1)
  })

  test('a spawn with no parent model', { options: { enforcement: 'strict' } }, async ($, on) => {
    const seen = world(on, {})
    const input = spawnOf({ subagentType: SECURITY }) as Partial<AgentSpawnInput>
    delete input.parentModel
    const result = await $.agent.spawn(input as AgentSpawnInput)
    expect(result.deny).toBeUndefined()
    expect(seen.spawns).toHaveLength(1)
  })
})
