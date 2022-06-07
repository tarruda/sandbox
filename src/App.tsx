import {useState, useEffect} from 'react'
import './App.css';

import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import _ from 'underscore'

const fengari = require("fengari-web");

const storageKey = "flb-input-filter"

const luaSupport = `
return function(_, tag, ts, obj)
  local js = require "js"

  local function _is_array(t)
    return t[1] ~= nil
  end

  local function _to_lua(o)
    local t = js.typeof(o)
    local rv
    if t == 'undefined' or o == js.null then
      rv = nil
    elseif t == 'number' or t == 'boolean' or t == 'string' then
      rv = o
    elseif t == 'object' then
      rv = {}
      if js.instanceof(o, js.global.Array) then
        for item in js.of(o) do
          rv[#rv + 1] = _to_lua(item)
        end
      else
        for key in js.of(js.global.Object:keys(o)) do
          rv[key] = _to_lua(o[key])
        end
      end
    else
      error("Unsupported type")
    end
    return rv
  end

  local function _to_js(o)
    local t = type(o)

    if t ~= 'table' then
      return o
    end

    local rv
    if _is_array(o) then
      rv = js.new(js.global.Array)
      for _, v in ipairs(o) do
        rv:push(_to_js(v))
      end
    else
      rv = js.new(js.global.Object)
      for k, v in pairs(o) do
        rv[k] = _to_js(v)
      end
    end
    return rv
  end

  local code, ts, record = cb_filter(_to_lua(tag), _to_lua(ts), _to_lua(obj))
  return _to_js({code, ts, record})
end
`;

const initialInput = `{"log": "line 1"}
{"log": "line 2"}
{"log": "line 3"}
`
const initialFilter = `function cb_filter(tag, ts, record)
  record.message = 'hello from lua'
  return 1, ts, record
end
`

function run(input: string, filter: string, setOut: Function) {
  const jsonExpressions = input.split('\n')
  const filterScript = filter + '\n' + luaSupport
  const luaFn = fengari.load(filterScript)()
  const output = []
  const ts = 0
  const tag = "my-tag"
  for (const jsonStr of jsonExpressions) {
    if (!jsonStr.trim()) {
      continue
    }
    let obj: any
    try {
      obj = JSON.parse(jsonStr)
    } catch (err) {
      console.error(err)
      continue
    }
    const [code, newTs, newObj] = luaFn(tag, ts, obj)
    let resultTs
    let resultObj
    switch (code) {
      case 0:
        resultTs = ts
        resultObj = obj
      break
      case 1:
        resultTs = newTs
        resultObj = newObj
      break
      case 2:
        resultTs = ts
        resultObj = newObj
      break
      default:
        continue
    }

    if (Array.isArray(newObj)) {
      // split
      for (const item of newObj) {
        output.push(JSON.stringify([resultTs, item]))
      }
    } else {
      output.push(JSON.stringify([resultTs, resultObj]))
    }
  }
  localStorage.setItem(storageKey, JSON.stringify({ input, filter }))
  setOut(output.join('\n'))
}

const debouncedRun = _.debounce(run, 1000);

function App() {
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('')
  const [out, setOut] = useState('')

  useEffect(() => {
    const data = localStorage.getItem(storageKey)
    if (data) {
      let savedState: any
      try {
        savedState = JSON.parse(data)
        if (savedState.input && savedState.filter) {
          setInput(savedState.input)
          setFilter(savedState.filter)
        }
      } catch (err) {
        console.error(err)
      }
    } else {
      setInput(initialInput)
      setFilter(initialFilter)
    }

  }, [])

  useEffect(() => {
      debouncedRun(input, filter, setOut)
  }, [input, filter])

  return (
    <div>
      <h2>Input json (one JSON expression per line)</h2>
      <CodeMirror
        value={input}
        height="200px"
        extensions={[json()]}
        onChange={setInput}
      />

      <h2>Lua filter</h2>
      <CodeMirror
        value={filter}
        height="200px"
        extensions={[StreamLanguage.define(lua)]}
        onChange={setFilter}
      />

      <h2>Output json</h2>
      <CodeMirror
        value={out}
        height="200px"
        readOnly={true}
        extensions={[json()]}
      />
      <button
        onClick={()=>{
          localStorage.clear()
          setTimeout(() =>  {
            window.location.reload()
          }, 200)
        }}>
        Reset
      </button>
    </div>
);
}

export default App;
