@echo off
chcp 65001
echo ====================================
echo 一键部署后端代码脚本 (摘星译)
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
set /p commit_message="请输入本次提交的描述信息: "

:: 检查提交信息是否为空
if "%commit_message%"=="" (
    echo.
    echo 警告：提交信息不能为空，请重新运行脚本并输入描述。
    echo.
    pause
    exit /b 1
)

echo.
echo ====================================
echo (1/3) 正在执行本地 Git 操作...
echo ====================================

:: 1. 添加所有文件到暂存区
echo ^> git add .
git add .
if %errorlevel% neq 0 (
    echo.
    echo 错误：git add 命令执行失败。
    echo.
    pause
    exit /b 1
)

:: 2. 提交到本地仓库
echo ^> git commit -m "%commit_message%"
git commit -m "%commit_message%"
if %errorlevel% neq 0 (
    echo.
    echo 错误：git commit 命令执行失败，可能没有新的改动。
    echo.
    pause
    goto end_script
)

:: 3. 推送到远程仓库
echo ^> git push
git push
if %errorlevel% neq 0 (
    echo.
    echo 错误：git push 命令执行失败。
    echo.
    pause
    goto end_script
)

echo.
echo ====================================
echo (2/3) 本地操作成功，开始远程部署...
echo ====================================

:: 4. 通过SSH连接到远程服务器并执行命令
:: !!! 请将 "root@你的公网IP" 替换为你的实际信息 !!!
echo ^> ssh root@8.134.192.197 "cd /opt/zhaixingyi-backend && git pull && pm2 restart zhaixingyi-api"
ssh root@8.134.192.197 "cd /opt/zhaixingyi-backend && git pull && pm2 restart zhaixingyi-api"
if %errorlevel% neq 0 (
    echo.
    echo 错误：远程部署命令执行失败。
    echo 请检查网络连接、SSH配置或远程服务器上的Git/PM2状态。
    echo.
    pause
    goto end_script
)

echo.
echo ====================================
echo (3/3) 部署成功！
echo ====================================

:end_script
echo.
echo 脚本执行完毕。
pause