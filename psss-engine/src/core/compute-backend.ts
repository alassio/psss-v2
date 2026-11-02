import type {
  ComputeBackend,
  TextureDescriptor,
  BufferDescriptor,
  PipelineDescriptor,
  GPUTextureHandle,
  GPUBufferHandle,
  GPUPipelineHandle,
  GPUCommandList,
} from './interfaces.ts';
import { compileProgram } from './gl-program.ts';

export interface WebGL2TextureHandle {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer | null;
  width: number;
  height: number;
  format: string;
}

export interface WebGL2BufferHandle {
  buffer: WebGLBuffer;
  size: number;
}

export interface WebGL2PipelineHandle {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject | null;
}

export class WebGL2Backend implements ComputeBackend {
  readonly type = 'webgl2' as const;
  readonly device = null;
  readonly gl: WebGL2RenderingContext;
  private contextLostCallbacks: (() => void)[] = [];
  private floatTextureExt: unknown;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.floatTextureExt = gl.getExtension('EXT_color_buffer_float');
    if (!this.floatTextureExt) {
      console.warn('EXT_color_buffer_float not available; HDR trail buffer may not work');
    }
    gl.getExtension('OES_texture_float_linear');

    const canvas = gl.canvas;
    if (canvas instanceof HTMLCanvasElement) {
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.contextLostCallbacks.forEach(cb => cb());
      });
    }
  }

  createTexture(desc: TextureDescriptor): GPUTextureHandle {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create WebGL texture');

    gl.bindTexture(gl.TEXTURE_2D, texture);

    const { internalFormat, format, type } = this.getTextureFormat(desc.format);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, desc.width, desc.height, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const framebuffer = gl.createFramebuffer();
    if (framebuffer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);

    const handle: WebGL2TextureHandle = {
      texture,
      framebuffer,
      width: desc.width,
      height: desc.height,
      format: desc.format,
    };
    return handle as unknown as GPUTextureHandle;
  }

  createBuffer(desc: BufferDescriptor): GPUBufferHandle {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Failed to create WebGL buffer');

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (desc.data) {
      gl.bufferData(gl.ARRAY_BUFFER, desc.data, gl.DYNAMIC_DRAW);
    } else {
      gl.bufferData(gl.ARRAY_BUFFER, desc.size, gl.DYNAMIC_DRAW);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const handle: WebGL2BufferHandle = { buffer, size: desc.size };
    return handle as unknown as GPUBufferHandle;
  }

  createPipeline(desc: PipelineDescriptor): GPUPipelineHandle {
    const gl = this.gl;
    const program = compileProgram(gl, desc.vertex, desc.fragment, 'ComputeBackend pipeline');
    const vao = gl.createVertexArray();

    const handle: WebGL2PipelineHandle = { program, vao };
    return handle as unknown as GPUPipelineHandle;
  }

  submit(_commands: GPUCommandList): void {
    // WebGL2 commands are immediate-mode; this is a no-op placeholder
  }

  onContextLost(callback: () => void): void {
    this.contextLostCallbacks.push(callback);
  }

  dispose(): void {
    this.contextLostCallbacks = [];
  }

  private getTextureFormat(format: string): { internalFormat: number; format: number; type: number } {
    const gl = this.gl;
    switch (format) {
      case 'rgba16float':
        return { internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT };
      case 'rgba8unorm':
        return { internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
      case 'r32float':
        return { internalFormat: gl.R32F, format: gl.RED, type: gl.FLOAT };
      default:
        return { internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
    }
  }
}

export async function detectBackend(canvas: HTMLCanvasElement): Promise<ComputeBackend> {
  // Try WebGPU first
  if ('gpu' in navigator) {
    try {
      const adapter = await (navigator as unknown as { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter();
      if (adapter) {
        // WebGPU path would be implemented here in the future
        // For now, fall through to WebGL2
      }
    } catch {
      // WebGPU not available, fall through
    }
  }

  // WebGL2 fallback
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    antialias: false,
  });

  if (!gl) {
    throw new Error('Neither WebGPU nor WebGL2 is available');
  }

  return new WebGL2Backend(gl);
}
