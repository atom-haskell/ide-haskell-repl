_ = require 'underscore-plus'

escapeString = (string) ->
  string.replace /[&"'<> ]/g, (match) ->
    switch match
      when '&' then '&amp;'
      when '"' then '&quot;'
      when "'" then '&#39;'
      when '<' then '&lt;'
      when '>' then '&gt;'
      # when ' ' then '&nbsp;'
      else match

pushScope = (scopeStack, scope, html) ->
  scopeStack.push(scope)
  html += "<span class=\"#{scope.replace(/\.+/g, ' ')}\">"

popScope = (scopeStack, html) ->
  scopeStack.pop()
  html += '</span>'

updateScopeStack = (scopeStack, desiredScopes, html) ->
  excessScopes = scopeStack.length - desiredScopes.length
  if excessScopes > 0
    html = popScope(scopeStack, html) while excessScopes--

  # pop until common prefix
  for i in [scopeStack.length..0]
    break if _.isEqual(scopeStack[0...i], desiredScopes[0...i])
    html = popScope(scopeStack, html)

  # push on top of common prefix until scopeStack is desiredScopes
  for j in [i...desiredScopes.length]
    html = pushScope(scopeStack, desiredScopes[j], html)

  html


module.exports =
highlightSync = ({registry, fileContents, scopeName} = {}) ->
  registry ?= atom.grammars

  grammar = registry.grammarForScopeName(scopeName)
  return unless grammar?

  lineTokens = grammar.tokenizeLines(fileContents)

  # Remove trailing newline
  if lineTokens.length > 0
    lastLineTokens = lineTokens[lineTokens.length - 1]

    if lastLineTokens.length is 1 and lastLineTokens[0].value is ''
      lineTokens.pop()

  # html = '<div class="editor editor-colors">'
  html = ''
  for tokens in lineTokens
    scopeStack = []
    # html += '<div class="line">'
    for {value, scopes} in tokens
      value = ' ' unless value
      scopes = scopes.map (s) -> "syntax--#{s.replace(/\./g, '.syntax--')}"
      html = updateScopeStack(scopeStack, scopes, html)
      html += "<span>#{escapeString(value)}</span>"
    html = popScope(scopeStack, html) while scopeStack.length > 0
    html += '\n'
    # html += '</div>'
  # html += '</div>'
  html
