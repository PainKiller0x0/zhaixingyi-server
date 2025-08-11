@echo off
chcp 65001
echo ====================================
echo Git 后端代码提交与推送脚本 (摘星译)
echo ====================================

:: 检查当前目录是否有.git文件夹
if not exist ".git" (
    echo.
    echo 错误：当前目录似乎不是一个Git仓库。
    echo 请确保在后端代码的根目录运行此脚本。
    echo.
    pause
    exit /b 1
)

:: 提示用户输入提交信息
set /p commit_message="请输入本次提交的描述信息 (例如: feat: 添加新的反馈接口): "

:: 检查提交信息是否为空
if "%commit_message%"=="" (
    echo.
    echo 警告：提交信息不能为空，请重新运行脚本并输入描述。
    echo.
    pause
    exit /b 1
)

echo.
echo 正在执行 Git 操作...

:: 1. 添加所有文件到暂存区
echo ^> git add .
git add .
if %errorlevel% neq 0 (
    echo.
    echo 错误：git add 命令执行失败。请检查Git状态或文件权限。
    echo.
    pause
    exit /b 1
)

:: 2. 提交到本地仓库
echo ^> git commit -m "%commit_message%"
git commit -m "%commit_message%"
if %errorlevel% neq 0 (
    echo.
    echo 错误：git commit 命令执行失败。
    echo 可能是没有新的改动，或者存在其他Git问题。
    echo.
    pause
    exit /b 1
)

:: 3. 推送到远程仓库
echo ^> git push
git push
if %errorlevel% neq 0 (
    echo.
    echo 错误：git push 命令执行失败。
    echo 请检查网络连接，或远程仓库配置，或是否有权限。
    echo.
    pause
    exit /b 1
)

echo.
echo ====================================
echo Git 操作成功完成！
echo 本次提交信息: "%commit_message%"
echo ====================================
echo.
pause