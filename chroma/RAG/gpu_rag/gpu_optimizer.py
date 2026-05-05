import torch
import psutil
import os
from typing import Dict, Any

GPU_DEVICE_INDEX = 1

def optimize_gpu_settings():
    """
    Optimize GPU settings for RTX 3060 with 12GB VRAM.
    """
    print("=== GPU Optimization for RTX 3060 ===")
    
    # Check CUDA availability
    if not torch.cuda.is_available():
        print("❌ CUDA is not available. Please install CUDA and PyTorch with CUDA support.")
        return False

    if torch.cuda.device_count() <= GPU_DEVICE_INDEX:
        print(f"❌ GPU {GPU_DEVICE_INDEX} requested, but only {torch.cuda.device_count()} CUDA device(s) are available.")
        return False

    torch.cuda.set_device(GPU_DEVICE_INDEX)
    
    # Get GPU info
    gpu_name = torch.cuda.get_device_name(GPU_DEVICE_INDEX)
    total_memory = torch.cuda.get_device_properties(GPU_DEVICE_INDEX).total_memory / 1024**3
    
    print(f"✅ GPU detected: {gpu_name}")
    print(f"✅ Total VRAM: {total_memory:.1f} GB")
    
    # Set optimal PyTorch settings for RTX 3060
    torch.backends.cudnn.benchmark = True
    torch.backends.cudnn.deterministic = False
    
    # Set memory fraction to use (80% of 12GB = ~9.6GB)
    memory_fraction = 0.8
    torch.cuda.set_per_process_memory_fraction(memory_fraction, GPU_DEVICE_INDEX)
    
    print(f"✅ CUDA memory fraction set to {memory_fraction*100}%")
    print("✅ CUDNN benchmark enabled for optimal performance")
    
    # Test GPU memory allocation
    try:
        test_tensor = torch.randn(1000, 1000, device=f'cuda:{GPU_DEVICE_INDEX}')
        del test_tensor
        torch.cuda.empty_cache()
        print("✅ GPU memory test successful")
    except Exception as e:
        print(f"❌ GPU memory test failed: {e}")
        return False
    
    return True

def get_system_info() -> Dict[str, Any]:
    """
    Get comprehensive system information.
    """
    info = {
        "cpu": {
            "count": psutil.cpu_count(),
            "percent": psutil.cpu_percent(interval=1),
            "memory": {
                "total_gb": psutil.virtual_memory().total / 1024**3,
                "available_gb": psutil.virtual_memory().available / 1024**3,
                "percent": psutil.virtual_memory().percent
            }
        }
    }
    
    if torch.cuda.is_available():
        if torch.cuda.device_count() <= GPU_DEVICE_INDEX:
            info["gpu"] = {
                "requested_device": GPU_DEVICE_INDEX,
                "available_devices": torch.cuda.device_count(),
                "error": "requested GPU is not available"
            }
            return info

        info["gpu"] = {
            "device": f"cuda:{GPU_DEVICE_INDEX}",
            "name": torch.cuda.get_device_name(GPU_DEVICE_INDEX),
            "total_memory_gb": torch.cuda.get_device_properties(GPU_DEVICE_INDEX).total_memory / 1024**3,
            "allocated_memory_gb": torch.cuda.memory_allocated(GPU_DEVICE_INDEX) / 1024**3,
            "cached_memory_gb": torch.cuda.memory_reserved(GPU_DEVICE_INDEX) / 1024**3,
            "memory_percent": (torch.cuda.memory_allocated(GPU_DEVICE_INDEX) / torch.cuda.get_device_properties(GPU_DEVICE_INDEX).total_memory) * 100
        }
    
    return info

def print_optimization_tips():
    """
    Print optimization tips for RTX 3060.
    """
    print("\n=== Optimization Tips for RTX 3060 ===")
    print("1. Batch Size: Use batch_size=32 for optimal performance")
    print("2. Model Loading: Load models to GPU during initialization")
    print("3. Memory Management: Use torch.no_grad() for inference")
    print("4. Cache Management: Call torch.cuda.empty_cache() after large operations")
    print("5. Mixed Precision: Consider using torch.float16 for memory efficiency")
    print("6. Parallel Processing: Use multiple workers for data loading")
    print("7. Model Optimization: Use model.eval() for inference mode")

def monitor_performance():
    """
    Monitor real-time performance metrics.
    """
    print("\n=== Performance Monitoring ===")
    
    while True:
        try:
            info = get_system_info()
            
            print(f"\rCPU: {info['cpu']['percent']}% | "
                  f"RAM: {info['cpu']['memory']['percent']}% | "
                  f"GPU: {info.get('gpu', {}).get('memory_percent', 0):.1f}%", end="")
            
            import time
            time.sleep(2)
            
        except KeyboardInterrupt:
            print("\nMonitoring stopped.")
            break

if __name__ == "__main__":
    # Run optimization
    if optimize_gpu_settings():
        print_optimization_tips()
        
        # Ask if user wants to monitor performance
        response = input("\nWould you like to start performance monitoring? (y/n): ")
        if response.lower() == 'y':
            monitor_performance()
    else:
        print("GPU optimization failed. Please check your CUDA installation.") 