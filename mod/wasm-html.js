export class WasmHTML extends HTMLElement {
  connectedCallback() {
	console.log("WASM CONNECTED", this)
	const wasmURL = this.getAttribute("src") ?? this.querySelector("source[type='application/wasm']")?.src;
	if (wasmURL) {
	  const wasmInstancePromise = WebAssembly.instantiateStreaming(fetch(wasmURL, { credentials: "omit" }))
	  .then(a => {
		console.log("Loaded wasm directly", Date.now() - window.startTime);
		return a;
	  });
	  initWasmHTML(this, wasmInstancePromise);
	}

	// const importUrl = this.dataset.importUrl ?? this.querySelector("source[type='text/javascript']")?.src;
	// if (importUrl) {
	//   const memory = new WebAssembly.Memory({ initial: 2 });
	//   const wasmModulePromise = window.importModule(importUrl);
	//   console.log("import(this.dataset.scriptUrl)", wasmModulePromise);
	//   const wasmInstancePromise = wasmModulePromise
	// 	.then(exports => {
	// 	  console.log("Loaded wasm via import()", Date.now() - window.startTime);
	// 	  console.log("ES MODULE", exports);
	// 	  return exports.wasmModulePromise;
	// 	})
	// 	.then(module => {
	// 	  console.log("MODULE", module);
	// 	  const instancePromise = WebAssembly.instantiate(module, {
	// 		env: {
	// 		  buffer: memory
	// 		}
	// 	  });
	// 	  return instancePromise;
	// 	})
	// 	.then(instance => ({ instance }));
	//   initWasmHTML(this, wasmInstancePromise);
	// }
  }
}

function initWasmHTML(el, wasmInstancePromise) {
  wasmInstancePromise.then(({ instance }) => {
	const memory = instance.exports.memory;
	const rewind = instance.exports.rewind;
	const next_body_chunk = instance.exports.next_body_chunk;

	const memoryBytes = new Uint8Array(memory.buffer);
	const utf8encoder = new TextEncoder();
	const utf8decoder = new TextDecoder();

	function update() {
	  rewind?.call();

	  const chunks = [];
	  //const chunks = new Uint8Array(1000);
	  while (true) {
		const ptr = next_body_chunk();
		if (ptr === 0) {
		  break;
		}

		// Search for null-terminating byte.
		const endPtr = memoryBytes.indexOf(0, ptr);
		// Get subsection of memory between start and end, and decode it as UTF-8.
		//return utf8decoder.decode(memoryBytes.subarray(ptr, endPtr));
		//chunks.concat(memoryToRead.subarray(0, count));
		chunks.push(memoryBytes.subarray(ptr, endPtr));
		//chunks.set(memoryBytes.subarray(ptr, endPtr), chunks.length);
	  }

	  // There surely must be a better way to do this.
	  // See: https://stackoverflow.com/questions/49129643/how-do-i-merge-an-array-of-uint8arrays
	  const bytes = new Uint8Array(chunks.map(chunk => [...chunk]).flat());
	  const html = utf8decoder.decode(bytes);
	  console.log("wasm-html render", html)
	  el.innerHTML = html;
	}

	el.addEventListener("click", (event) => {
	  const action = event.target.dataset.action;
	  if (typeof action === "string" && typeof instance.exports[action] === "function") {
		instance.exports[action].apply();
	  }
	  update();
	});

	queueMicrotask(update);
  });
}
